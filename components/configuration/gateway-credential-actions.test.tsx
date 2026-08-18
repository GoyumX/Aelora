import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GatewayCredentialActions } from "@/components/configuration/gateway-credential-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("GatewayCredentialActions", () => {
  it("stages a one-time credential rotation for the separately running gateway", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {
        credential: "aelora_credential_rotated-secret",
        expiresAt: "2026-08-11T11:00:00.000Z",
        credentialVersion: 2,
      } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<GatewayCredentialActions gateway={{ id: "gateway-1", name: "Virtual plant" }} siteId="site-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Rotate credential for Virtual plant" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/sites/site-1/gateways/gateway-1/credential-rotations",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("aelora_credential_rotated-secret")).toBeInTheDocument();
    expect(screen.getByText(/paste it into the local gateway console/i)).toBeInTheDocument();
  });

  it("revokes a gateway only after explicit confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { revoked: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<GatewayCredentialActions gateway={{ id: "gateway-1", name: "Virtual plant" }} siteId="site-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke Virtual plant" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/sites/site-1/gateways/gateway-1/revocations",
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
