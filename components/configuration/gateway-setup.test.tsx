import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GatewaySetup } from "@/components/configuration/gateway-setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

describe("GatewaySetup", () => {
  it("creates a separate virtual gateway enrollment and reveals its token once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {
        id: "gateway-1",
        enrollmentToken: "aelora_enroll_example-secret",
        enrollmentExpiresAt: "2026-08-11T11:00:00.000Z",
      } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<GatewaySetup siteId="site-1" />);

    fireEvent.change(screen.getByLabelText("Gateway name"), { target: { value: "Development virtual plant" } });
    fireEvent.click(screen.getByRole("button", { name: "Create enrollment" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/sites/site-1/gateways", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("aelora_enroll_example-secret")).toBeInTheDocument();
    expect(screen.getByText(/separate Python gateway/i)).toBeInTheDocument();
    expect(screen.getByText(/shown only in this response/i)).toBeInTheDocument();
  });
});
