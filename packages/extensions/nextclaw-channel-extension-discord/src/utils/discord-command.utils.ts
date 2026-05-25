import type { ChannelCommandOption } from "@nextclaw/extension-sdk";
import { ApplicationCommandOptionType } from "discord.js";

export function mapCommandOptions(options?: ChannelCommandOption[]): Array<Record<string, unknown>> | undefined {
    if (!options || options.length === 0) {
        return undefined;
    }
    return options.map((option) => ({
        name: option.name,
        description: option.description,
        type: mapCommandOptionType(option.type),
        required: option.required ?? false
    }));
}

function mapCommandOptionType(type: ChannelCommandOption["type"]): number {
    switch (type) {
        case "boolean":
            return ApplicationCommandOptionType.Boolean;
        case "number":
            return ApplicationCommandOptionType.Number;
        case "string":
        default:
            return ApplicationCommandOptionType.String;
    }
}
