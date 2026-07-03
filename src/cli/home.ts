import type { AxiCliCommand } from "axi-sdk-js";
import type { CliContext } from "./context.js";
import { buildHomeFacts } from "./home-facts.js";

export const homeCommand: AxiCliCommand<CliContext> = () => buildHomeFacts();
