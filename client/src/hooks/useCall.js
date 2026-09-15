import { useContext } from "react";
import { CallContext } from "../context/CallContext";

export function useCall() {
  const context = useContext(CallContext);
  if (context === null) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}
