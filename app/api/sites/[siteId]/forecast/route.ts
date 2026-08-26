import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  ForecastDomainError,
  generateSiteForecast,
} from "@/lib/forecast/forecast-service";
import {
  MlForecastConfigurationError,
  MlForecastContractError,
  MlForecastUnavailableError,
} from "@/lib/forecast/ml-client";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: noStoreHeaders },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse("unauthorized", "Authentication is required.", 401);
  }

  const { siteId } = await params;
  try {
    const data = await generateSiteForecast(
      { id: user.id, role: user.role },
      siteId,
    );
    return NextResponse.json({ data }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof ForecastDomainError) {
      if (error.code === "site_not_found") {
        return errorResponse("site_not_found", "Solar site was not found.", 404);
      }
      if (error.code === "ml_identity_mismatch") {
        return errorResponse(
          "forecast_contract_error",
          "The forecast service returned an invalid response.",
          502,
        );
      }
      const message = error.code === "capacity_unavailable"
        ? "Configure at least one active solar array before forecasting."
        : "A complete stored weather forecast is required before forecasting.";
      return errorResponse(error.code, message, 409);
    }
    if (
      error instanceof MlForecastConfigurationError
      || error instanceof MlForecastUnavailableError
    ) {
      return errorResponse(
        "forecast_service_unavailable",
        "The AI forecast service is temporarily unavailable.",
        503,
      );
    }
    if (error instanceof MlForecastContractError) {
      return errorResponse(
        "forecast_contract_error",
        "The forecast service returned an invalid response.",
        502,
      );
    }
    console.error("Unexpected solar forecast generation failure", error);
    return errorResponse("internal_error", "The forecast could not be generated.", 500);
  }
}
