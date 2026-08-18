import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SolarArrayForm } from "@/components/configuration/solar-array-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("SolarArrayForm", () => {
  it("labels equipment fields and creates an array through the owned site endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { id: "array-1" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SolarArrayForm siteId="site-1" />);

    fireEvent.change(screen.getByLabelText("Array name"), { target: { value: "West roof" } });
    fireEvent.change(screen.getByLabelText("Panel count"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Rated power per panel"), { target: { value: "440" } });
    fireEvent.click(screen.getByRole("button", { name: "Add solar array" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/sites/site-1/solar-arrays", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("Solar array added.")).toBeInTheDocument();
  });

  it("keeps the entered values and announces an API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: { message: "An array with this name already exists at this site." } }) }));
    render(<SolarArrayForm siteId="site-1" />);
    fireEvent.change(screen.getByLabelText("Array name"), { target: { value: "West roof" } });
    fireEvent.click(screen.getByRole("button", { name: "Add solar array" }));

    expect(await screen.findByText("An array with this name already exists at this site.")).toBeInTheDocument();
    expect(screen.getByLabelText("Array name")).toHaveValue("West roof");
  });
});
