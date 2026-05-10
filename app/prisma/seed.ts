import { PrismaClient, MembershipStatus, InvoiceKind, InvoiceStatus, InstallmentStatus, ComplianceStatus, TaskStatus, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph",
  "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy",
  "Daniel", "Lisa", "Matthew",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris",
];
const CLASSES = ["Full", "Social", "Junior", "Honorary", "Non-Resident"];
const STATES = ["CT", "NY", "NJ", "MA", "FL", "CA"];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  console.log("[seed] resetting domain tables");
  await prisma.checkinLog.deleteMany();
  await prisma.complianceCertificate.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.statement.deleteMany();
  await prisma.houseCharge.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.committeeMembership.deleteMany();
  await prisma.committee.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.dependent.deleteMany();
  await prisma.address.deleteMany();
  await prisma.task.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();

  console.log("[seed] creating admin");
  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.create({
    data: {
      email: "admin@club.local",
      name: "Admin",
      role: "ADMIN",
      capabilities: [
        "members.read",
        "members.write",
        "finance.read",
        "finance.write",
        "events.read",
        "events.write",
        "houseAccounts.read",
        "houseAccounts.write",
        "compliance.read",
        "compliance.write",
        "settings.write",
      ],
      passwordHash,
      emailVerified: new Date(),
    },
  });

  console.log("[seed] creating 25 members");
  const members = [];
  for (let i = 0; i < 25; i++) {
    const firstName = pick(FIRST_NAMES, i);
    const lastName = pick(LAST_NAMES, i + 7);
    const email = `${firstName}.${lastName}.${i}@example.com`.toLowerCase();
    const member = await prisma.member.create({
      data: {
        memberNumber: String(1000 + i),
        firstName,
        lastName,
        email,
        phone: `+1-555-${String(1000 + i).padStart(4, "0")}`,
        membershipClass: pick(CLASSES, i),
        membershipStatus: i % 11 === 0 ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE,
        joinDate: new Date(2010 + (i % 14), i % 12, 1 + (i % 28)),
        birthDate: new Date(1955 + (i * 2 % 50), i % 12, 1 + (i % 28)),
        addresses: {
          create: {
            street1: `${100 + i} ${pick(["Oak", "Maple", "Elm", "Pine"], i)} Lane`,
            city: pick(["Greenwich", "Westport", "Darien", "New Canaan"], i),
            state: pick(STATES, i),
            zip: `0${6800 + i}`,
            isPrimary: true,
          },
        },
      },
    });
    members.push(member);
  }

  console.log("[seed] creating 2 groups + memberships");
  await prisma.group.create({
    data: {
      name: "Golf Committee Members",
      description: "Members active in golf programming",
      type: "interest",
      memberships: {
        create: members.slice(0, 8).map((m) => ({ memberId: m.id, role: "member" })),
      },
    },
  });
  await prisma.group.create({
    data: {
      name: "Tennis & Pickleball",
      description: "Racquet sports members",
      type: "interest",
      memberships: {
        create: members.slice(5, 12).map((m) => ({ memberId: m.id, role: "member" })),
      },
    },
  });

  console.log("[seed] creating 1 committee");
  await prisma.committee.create({
    data: {
      name: "House Committee",
      description: "Oversees clubhouse operations",
      memberships: {
        create: members.slice(0, 5).map((m, idx) => ({
          memberId: m.id,
          role: idx === 0 ? "chair" : "member",
        })),
      },
    },
  });

  console.log("[seed] creating 2 events");
  const now = new Date();
  await prisma.event.create({
    data: {
      title: "Member-Guest Tournament",
      description: "Annual two-day golf tournament",
      startAt: new Date(now.getFullYear(), now.getMonth() + 1, 15, 8, 0),
      endAt: new Date(now.getFullYear(), now.getMonth() + 1, 16, 17, 0),
      venue: "Main Golf Course",
      capacity: 80,
      memberPriceCents: 25000,
      guestPriceCents: 35000,
      isTicketed: true,
      attendances: {
        create: members.slice(0, 6).map((m) => ({
          memberId: m.id,
          status: AttendanceStatus.GOING,
        })),
      },
    },
  });
  await prisma.event.create({
    data: {
      title: "Welcome Reception",
      description: "Cocktails for new members",
      startAt: new Date(now.getFullYear(), now.getMonth(), 28, 18, 0),
      endAt: new Date(now.getFullYear(), now.getMonth(), 28, 21, 0),
      venue: "Grand Ballroom",
      isTicketed: false,
    },
  });

  console.log("[seed] creating sample dues invoice with 3 installments");
  const duesInvoice = await prisma.invoice.create({
    data: {
      number: "INV-2026-0001",
      memberId: members[0].id,
      status: InvoiceStatus.SENT,
      kind: InvoiceKind.DUES,
      currency: "USD",
      totalCents: 1500000,
      dueDate: new Date(now.getFullYear(), 0, 31),
      lines: {
        create: [
          {
            description: "Annual Dues",
            quantity: 1,
            unitCents: 1400000,
            totalCents: 1400000,
            kind: InvoiceKind.DUES,
          },
          {
            description: "Capital Assessment",
            quantity: 1,
            unitCents: 100000,
            totalCents: 100000,
            kind: InvoiceKind.ASSESSMENT,
          },
        ],
      },
      installments: {
        create: [
          {
            sequence: 1,
            amountCents: 500000,
            adminFeeCents: 0,
            dueDate: new Date(now.getFullYear(), 0, 31),
            status: InstallmentStatus.SENT,
          },
          {
            sequence: 2,
            amountCents: 500000,
            adminFeeCents: 0,
            dueDate: new Date(now.getFullYear(), 3, 30),
            status: InstallmentStatus.PENDING,
          },
          {
            sequence: 3,
            amountCents: 500000,
            adminFeeCents: 0,
            dueDate: new Date(now.getFullYear(), 6, 31),
            status: InstallmentStatus.PENDING,
          },
        ],
      },
    },
  });
  console.log(`[seed]   invoice ${duesInvoice.number} created`);

  console.log("[seed] creating sample house charges");
  for (let i = 0; i < 8; i++) {
    await prisma.houseCharge.create({
      data: {
        memberId: members[i % members.length].id,
        category: pick(["Dining", "Pro Shop", "Guest Fees", "Locker"], i),
        amountCents: (20 + i * 7) * 100,
        occurredOn: new Date(now.getFullYear(), now.getMonth(), 1 + i),
        memo: pick(["Sat dinner", "Tennis lesson", "Range balls", "Locker fee"], i),
      },
    });
  }

  console.log("[seed] creating 2 compliance certificates");
  await prisma.complianceCertificate.create({
    data: {
      memberId: members[0].id,
      type: "Background Check (Youth Program)",
      status: ComplianceStatus.CERTIFIED,
      certifiedOn: new Date(now.getFullYear() - 1, 5, 1),
      expiresOn: new Date(now.getFullYear() + 1, 5, 1),
    },
  });
  await prisma.complianceCertificate.create({
    data: {
      memberId: members[1].id,
      type: "Background Check (Youth Program)",
      status: ComplianceStatus.CERTIFIED,
      certifiedOn: new Date(now.getFullYear() - 2, 5, 1),
      expiresOn: new Date(now.getFullYear(), now.getMonth() + 1, 15),
    },
  });

  console.log("[seed] creating sample tasks + feedback");
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "admin@club.local" } });
  await prisma.task.create({
    data: {
      title: "Confirm catering for Member-Guest Tournament",
      description: "Need final headcount by next Monday.",
      status: TaskStatus.OPEN,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    },
  });
  await prisma.feedback.create({
    data: {
      message: "The new check-in flow is much faster on Friday nights.",
      page: "/checkin",
    },
  });

  console.log("[seed] done.");
  console.log("[seed]   admin: admin@club.local / admin1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
