import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PagePlaceholder } from "@/components/shell/page-placeholder";

describe("PagePlaceholder", () => {
  it("announces the page and its foundation status", () => {
    render(
      <PagePlaceholder
        description="Inspect current solar production."
        eyebrow="Monitoring"
        title="Live Monitoring"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Live Monitoring" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Foundation ready")).toBeInTheDocument();
    expect(screen.getByText("Inspect current solar production.")).toBeInTheDocument();
  });
});
