import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";

export interface SlackConfig {
  channel: string;
  message: string;
  webhookUrl?: string;
}

export class SlackExecutor implements ActionExecutor {
  type = "send_slack";

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing Slack action", { 
        runId, 
        actionId: action.id
      });

      const config = action.config as SlackConfig;
      
      // Resolve template variables
      const resolvedChannel = this.resolveTemplate(config.channel, context);
      const resolvedMessage = this.resolveTemplate(config.message, context);
      const resolvedWebhookUrl = config.webhookUrl 
        ? this.resolveTemplate(config.webhookUrl, context)
        : undefined;

      // Use webhook URL from config or try to get from environment
      const webhookUrl = resolvedWebhookUrl || process.env.SLACK_WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error("Slack webhook URL is required. Set SLACK_WEBHOOK_URL environment variable or provide webhookUrl in config.");
      }

      // Send message to Slack webhook
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: resolvedChannel,
          text: resolvedMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} ${errorText}`);
      }

      logger.info("Slack message sent successfully", { 
        runId, 
        actionId: action.id,
        channel: resolvedChannel
      });

      return {
        success: true,
        channel: resolvedChannel,
        message: resolvedMessage,
      };
    } catch (error) {
      logger.error("Error executing Slack action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}

