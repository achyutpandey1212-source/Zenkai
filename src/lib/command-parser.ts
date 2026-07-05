import { COMMAND_REGISTRY } from "./command-registry";

export interface ParsedCommand {
  commandId: string;
  args: Record<string, any>;
  raw: string;
}

export class CommandParser {
  /**
   * Quick check to see if user input is intended as a command.
   */
  static isCommand(message: string): boolean {
    return message.trim().startsWith("/");
  }

  /**
   * Parses raw user command string into Command ID and Key-Value args.
   * Example: `/schedule add Gym --date 2026-07-06 --startTime 07:00 --endTime 08:30`
   * Parsed: { commandId: "schedule.add", args: { title: "Gym", date: "2026-07-06", startTime: "07:00", endTime: "08:30" } }
   */
  static parse(message: string): ParsedCommand | null {
    const raw = message.trim();
    if (!raw.startsWith("/")) return null;

    // Split off the main prefix (e.g., /schedule add -> cmd prefix is "/schedule add")
    // Let's find the matching command registry definition with longest command string match
    // E.g., "/schedule add" matches "schedule.add" (prefix mapping: schedule.add is `/schedule add`)
    const commandText = raw.substring(1); // remove leading slash
    
    // Sort command definitions by category/title words length descending so we match specific subcommands first
    const sortedRegistry = [...COMMAND_REGISTRY].sort((a, b) => {
      const aStr = `${a.category.toLowerCase()} ${a.title.toLowerCase()}`;
      const bStr = `${b.category.toLowerCase()} ${b.title.toLowerCase()}`;
      return bStr.length - aStr.length;
    });

    let matchedCmd = null;
    let cmdPrefix = "";

    for (const def of sortedRegistry) {
      // Construct mapping string, e.g. schedule.add -> "schedule add"
      const mapping = `${def.category.toLowerCase()} ${def.title.toLowerCase()}`;
      const singleWordMapping = def.id.replace(".", " ").toLowerCase(); // "schedule add"
      
      if (
        commandText.toLowerCase().startsWith(mapping)
      ) {
        matchedCmd = def;
        cmdPrefix = mapping;
        break;
      } else if (commandText.toLowerCase().startsWith(singleWordMapping)) {
        matchedCmd = def;
        cmdPrefix = singleWordMapping;
        break;
      }
    }

    if (!matchedCmd) {
      // Fallback: check if we just matched the command ID directly
      const firstWord = commandText.split(" ")[0].toLowerCase();
      matchedCmd = COMMAND_REGISTRY.find(d => d.id.toLowerCase() === firstWord || d.id.replace(".", "").toLowerCase() === firstWord);
      if (matchedCmd) {
        cmdPrefix = firstWord;
      }
    }

    if (!matchedCmd) {
      return null;
    }

    // Now extract the remainder after cmdPrefix
    const argString = commandText.substring(cmdPrefix.length).trim();
    
    // Parse arguments. Arguments can be positional (usually the first main argument)
    // and flag-based (using --paramName paramValue).
    const args: Record<string, any> = {};

    // Let's parse flags: --name value, --date=value, etc.
    // Regex matches flags: --key "value" or --key=value or --key value
    const flagRegex = /--([a-zA-Z0-9]+)(?:[=\s]+(?:["']([^"']*)["']|([^\s]+)))?/g;
    let match;
    const flagMatches: { key: string; value: string; index: number; length: number }[] = [];

    while ((match = flagRegex.exec(argString)) !== null) {
      const key = match[1];
      const value = match[2] || match[3] || "";
      flagMatches.push({
        key,
        value,
        index: match.index,
        length: match[0].length
      });
      args[key] = value;
    }

    // Determine what's left as positional parameters (before the flags)
    let positionalPart = argString;
    if (flagMatches.length > 0) {
      // Take everything before the first flag
      positionalPart = argString.substring(0, flagMatches[0].index).trim();
    }

    // Assign the positional part to the first required string parameter if it matches
    const textParams = matchedCmd.parameters.filter(p => p.type === "string");
    if (positionalPart && textParams.length > 0) {
      // Find the first parameter not specified via flag
      const targetParam = textParams.find(p => !args[p.name]);
      if (targetParam) {
        // Strip outer quotes if any
        if ((positionalPart.startsWith('"') && positionalPart.endsWith('"')) || 
            (positionalPart.startsWith("'") && positionalPart.endsWith("'"))) {
          positionalPart = positionalPart.substring(1, positionalPart.length - 1);
        }
        args[targetParam.name] = positionalPart;
      }
    }

    return {
      commandId: matchedCmd.id,
      args,
      raw
    };
  }
}
