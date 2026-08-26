import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpSupportDashboard } from "@/components/support/help-support-dashboard";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const view = {
  user: { name: "Aelora User", email: "user@aelora.local" },
  sites: [{ id: "site-1", name: "Colombo Home" }],
  tickets: [{ id: "ticket-1", category: "TECHNICAL" as const, priority: "NORMAL" as const, status: "OPEN" as const, subject: "Existing gateway question", message: "Existing ticket details for support staff.", adminResponse: null, createdAt: "2026-08-22T09:00:00.000Z", updatedAt: "2026-08-22T09:00:00.000Z", site: { id: "site-1", name: "Colombo Home" } }],
};

describe("HelpSupportDashboard", () => {
  it("searches across guides and frequently asked questions", () => {
    render(<HelpSupportDashboard view={view} />);
    fireEvent.change(screen.getByPlaceholderText("Search guides and questions"), { target: { value: "confidence range" } });
    expect(screen.getByText("How forecasts and confidence ranges work")).toBeInTheDocument();
    expect(screen.queryByText("Configure panels, inverter, and battery")).not.toBeInTheDocument();
  });

  it("creates a local ticket and adds it to the user's history", async () => {
    const created = { ...view.tickets[0], id: "ticket-2", subject: "Gateway stopped publishing", message: "My virtual gateway has not published data for the last ten minutes." };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: created }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<HelpSupportDashboard view={view} />);

    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: created.subject } });
    fireEvent.change(screen.getByLabelText("Describe the issue"), { target: { value: created.message } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/support-tickets", expect.objectContaining({ method: "POST", body: expect.stringContaining('"siteId":"site-1"') })));
    expect(await screen.findByText(created.subject)).toBeInTheDocument();
  });

  it("clearly labels simulation, forecast, and local-support boundaries", () => {
    render(<HelpSupportDashboard view={view} />);
    expect(screen.getByText(/simulated telemetry is not measured hardware evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/tickets stay inside this Aelora database/i)).toBeInTheDocument();
  });

  it("shows an honest empty result and empty ticket state", () => {
    render(<HelpSupportDashboard view={{ ...view, sites: [], tickets: [] }} />);
    fireEvent.change(screen.getByPlaceholderText("Search guides and questions"), { target: { value: "unmatched phrase 9842" } });

    expect(screen.getByText(/No help content matched/)).toBeInTheDocument();
    expect(screen.getByText("You have not submitted a support ticket yet.")).toBeInTheDocument();
    expect(screen.getByLabelText("Related site")).toHaveValue("");
  });

  it("renders priority, site-free, progress, resolved, closed, and administrator-response states", () => {
    const tickets = [
      { ...view.tickets[0], id: "progress", status: "IN_PROGRESS" as const, priority: "HIGH" as const, site: null, adminResponse: "We are checking the gateway logs." },
      { ...view.tickets[0], id: "resolved", status: "RESOLVED" as const, subject: "Resolved question" },
      { ...view.tickets[0], id: "closed", status: "CLOSED" as const, subject: "Closed question" },
    ];
    render(<HelpSupportDashboard view={{ ...view, tickets }} />);

    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("High priority")).toBeInTheDocument();
    expect(screen.getByText("We are checking the gateway logs.")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("displays a server validation error without adding a ticket", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: { message: "Please add diagnostic details." } }) }));
    render(<HelpSupportDashboard view={view} />);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "DATA_FORECAST" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("Related site"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Forecast evidence question" } });
    fireEvent.change(screen.getByLabelText("Describe the issue"), { target: { value: "The completed interval does not yet have enough verification labels." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please add diagnostic details.");
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("falls back to a safe message when an invalid error response cannot be decoded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.reject(new Error("invalid response")) }));
    render(<HelpSupportDashboard view={view} />);
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Gateway diagnostic request" } });
    fireEvent.change(screen.getByLabelText("Describe the issue"), { target: { value: "The gateway is running but the application still reports stale data." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The support ticket could not be submitted.");
  });
});
