import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SiteConfigurationForm } from "@/components/configuration/site-configuration-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("SiteConfigurationForm", () => {
  it("refreshes weather from the saved site location", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { id: "site-1" } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { synced: true } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SiteConfigurationForm site={{ id: "site-1", name: "Home", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" }} />);

    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "7.2906" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "80.6337" } });
    fireEvent.click(screen.getByRole("button", { name: "Save site" }));

    await waitFor(() => expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/sites/site-1/weather",
      { method: "POST" },
    ));
    expect(await screen.findByText("Site configuration saved and weather refreshed.")).toBeInTheDocument();
  });
});
