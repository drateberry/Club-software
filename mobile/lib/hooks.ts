import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClubOSClient, type AttendanceStatus, type Me, type SavedPaymentMethod } from "@club-os/sdk";
import { getAccessToken, setAccessToken } from "./api";
import { config } from "./config";

export const apiClient = new ClubOSClient({
  baseUrl: config.apiBase,
  getToken: () => getAccessToken(),
  onUnauthorized: () => setAccessToken(null),
});

export type { Me, SavedPaymentMethod };

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiClient.me() });
}

export function useMembers(search?: string) {
  return useQuery({
    queryKey: ["members", search],
    queryFn: () => apiClient.listMembers(search ? { search } : {}),
  });
}

export function useInvoices(opts: { status?: string; memberId?: string } = {}) {
  return useQuery({
    queryKey: ["invoices", opts],
    queryFn: () => apiClient.listInvoices(opts),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiClient.getInvoice(id!),
    enabled: !!id,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => apiClient.listEvents({ upcoming: true }),
  });
}

export function useRsvpEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: AttendanceStatus }) =>
      apiClient.rsvpEvent(eventId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useBuyTicket() {
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string }) => apiClient.buyTicket(eventId),
  });
}

export function useHouseBalance(memberId?: string) {
  return useQuery({
    queryKey: ["house-balance", memberId],
    queryFn: () => apiClient.getHouseBalance(memberId),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiClient.listConversations(),
  });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ passToken, memberId }: { passToken?: string; memberId?: string }) =>
      apiClient.logCheckin({ passToken, memberId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkin-recent"] }),
  });
}

export function useRecentCheckins() {
  return useQuery({
    queryKey: ["checkin-recent"],
    queryFn: () => apiClient.recentCheckins(),
  });
}

export function usePaymentMethods(memberId?: string) {
  return useQuery({
    queryKey: ["payment-methods", memberId],
    queryFn: () => apiClient.listPaymentMethods(memberId),
  });
}

export function useOpenCustomerPortal() {
  return useMutation({
    mutationFn: ({ returnUrl }: { returnUrl?: string } = {}) =>
      apiClient.openCustomerPortal({ returnUrl }),
  });
}
