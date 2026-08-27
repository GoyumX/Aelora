import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsDashboard } from "@/components/settings/settings-dashboard";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme }) }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

const view = {
  profile: { id: "user-1", name: "Aelora User", username: "aelora-user", email: "user@aelora.local", image: null, role: "USER" as const },
  preferences: { theme: "SYSTEM" as const, timezone: "Asia/Colombo", measurementSystem: "METRIC" as const, emailNotifications: true, defaultSiteId: "site-1" },
  sites: [{ id: "site-1", name: "Colombo Home", timezone: "Asia/Colombo", status: "ACTIVE" as const }],
  sessions: [{ id: "session-current", createdAt: "2026-08-22T07:00:00.000Z", updatedAt: "2026-08-22T08:00:00.000Z", expiresAt: "2026-08-29T07:00:00.000Z", ipAddress: "127.0.0.1", userAgent: "Chrome on Windows", isCurrent: true }],
};

describe("SettingsDashboard", () => {
  it("saves profile and application preferences and applies the selected theme", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: view }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsDashboard view={view} />);

    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Nimal Perera" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "nimal.solar" } });
    fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"name":"Nimal Perera"') })));
    expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ body: expect.stringContaining('"username":"nimal.solar"') }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("shows account identity details and a password recovery route", () => {
    render(<SettingsDashboard view={view} />);

    expect(screen.getByLabelText("Username")).toHaveValue("aelora-user");
    expect(screen.getByLabelText("Email address")).toHaveValue("user@aelora.local");
    expect(screen.getByRole("link", { name: "Reset a forgotten password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the current session without exposing a session token", () => {
    render(<SettingsDashboard view={view} />);
    expect(screen.getByText("Current session")).toBeInTheDocument();
    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.queryByText("session-current")).not.toBeInTheDocument();
  });

  it("requires matching password confirmation before sending a change", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsDashboard view={view} />);

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "OldPassword1!" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword2!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "DifferentPassword3!" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
