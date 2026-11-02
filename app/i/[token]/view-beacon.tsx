"use client";

import { useEffect } from "react";
import { recordViewAction } from "./actions";

export function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    void recordViewAction(token);
  }, [token]);
  return null;
}
