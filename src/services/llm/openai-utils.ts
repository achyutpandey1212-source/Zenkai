/* eslint-disable @typescript-eslint/no-explicit-any */
function translateGeminiContentsToOpenAI(contents: any[]): any[] {
  if (!contents || !Array.isArray(contents)) return [];

  const messages: any[] = [];

  for (const item of contents) {
    if (!item || typeof item !== "object") continue;

    const role = item.role;

    if (item.parts && Array.isArray(item.parts)) {
      const textParts: string[] = [];
      const inlineDataParts: any[] = [];

      for (const part of item.parts) {
        if (typeof part === "string") {
          textParts.push(part);
        } else if (part && typeof part === "object") {
          if (part.text) {
            textParts.push(part.text);
          }
          if (part.inlineData) {
            inlineDataParts.push({
              type: "image_url",
              image_url: {
                url: `data:${part.inlineData.mimeType || "application/octet-stream"};base64,${part.inlineData.data}`,
              },
            });
          }
        }
      }

      const content: any[] = [];
      if (textParts.length > 0) {
        content.push({ type: "text", text: textParts.join("\n") });
      }
      content.push(...inlineDataParts);

      if (content.length > 0) {
        messages.push({
          role: role || "user",
          content: content.length === 1 && content[0].type === "text" ? content[0].text : content,
        });
      }
    } else if (item.inlineData) {
      messages.push({
        role: role || "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${item.inlineData.mimeType || "application/octet-stream"};base64,${item.inlineData.data}`,
            },
          },
        ],
      });
    } else if (item.text) {
      messages.push({
        role: role || "user",
        content: item.text,
      });
    }
  }

  return messages;
}

export function buildOpenAIMessages(request: any): any[] {
  const messages: any[] = [];

  if (request.systemInstruction) {
    messages.push({ role: "system", content: request.systemInstruction });
  }

  if (request.contents) {
    messages.push(...translateGeminiContentsToOpenAI(request.contents));
  }

  if (request.prompt) {
    messages.push({ role: "user", content: request.prompt });
  }

  return messages;
}
