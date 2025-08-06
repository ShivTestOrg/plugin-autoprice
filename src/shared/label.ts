import { PRIORITY_REGEX, TIME_REGEX } from "../handlers/auto-price";
import { Context } from "../types/context";
import { GraphQlFetchPriorities } from "../types/github";
import { FetchedPriorities } from "../types/label";

// cspell:disable
export const COLORS = { default: "ededed", price: "1f883d" };
// cspell:enable

const NO_REPO_OWNER = "No owner found in the repository!";

export async function createLabel(context: Context, name: string, labelType = "default" as keyof typeof COLORS, description?: string): Promise<void> {
  const payload = context.payload;

  const color = name.startsWith("Price: ") ? COLORS.price : COLORS[labelType];
  const owner = payload.repository.owner?.login;
  if (!owner) {
    throw context.logger.error(NO_REPO_OWNER);
  }

  try {
    const createLabelsOptions = {
      owner,
      repo: payload.repository.name,
      name,
      color,
      description,
    };
    context.logger.debug("Trying to create label", { createLabelsOptions });
    await context.octokit.rest.issues.createLabel(createLabelsOptions);
  } catch (err) {
    context.logger.error("Creating a label failed!", { err });
  }
}

export async function clearAllPriceLabelsOnIssue(context: Context) {
  const payload = context.payload;
  if (!("issue" in payload) || !payload.issue) {
    return;
  }

  const labels = payload.issue.labels;
  if (!labels) return;

  // Collect all labels to remove: Price, Pricing, Priority, Time
  const labelsToRemove = labels.filter(
    (label) =>
      label.name.toString().startsWith("Price: ") ||
      label.name.toString().startsWith("Pricing: ") ||
      label.name.toString().startsWith("Priority: ") ||
      label.name.toString().startsWith("Time: ")
  );

  if (!labelsToRemove.length) return;

  for (const label of labelsToRemove) {
    try {
      await context.octokit.rest.issues.removeLabel({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        name: label.name,
      });
    } catch (err) {
      // Sometimes labels are out of sync or the label was manually added, which is safe to ignore since we are
      // updating all the labels.
      if (err && typeof err === "object" && "status" in err && err.status === 404) {
        context.logger.error(`Label [${label.name}] not found on issue ${payload.issue.html_url}, ignoring.`, { err });
      } else {
        throw context.logger.error(`Removing label on issue ${payload.issue.html_url} failed!`, { label, err });
      }
    }
  }
}
export async function getCurrentPriorities(context: Context, issueIds: string[]): Promise<FetchedPriorities[]> {
  const results: FetchedPriorities[] = [];

  for (const issueId of issueIds) {
    try {
      const { node } = await context.octokit.graphql<GraphQlFetchPriorities>(
        /* GraphQL */
        `
          query ($id: ID!) {
            node(id: $id) {
              ... on Issue {
                title
                number
                state
                repository {
                  name
                  owner {
                    login
                  }
                }
                labels(first: 100) {
                  nodes {
                    name
                  }
                }
              }
            }
          }
        `,
        { id: issueId }
      );
      if (!node || node.state.toLowerCase() !== "open" || !node.repository) continue;

      const labels = node.labels?.nodes ?? [];
      const priorityLabel = labels.find((l) => PRIORITY_REGEX.test(l.name));
      const priorityValue = priorityLabel?.name.match(PRIORITY_REGEX)?.[1] ?? "1";

      results.push({
        issueId,
        priority: priorityValue,
        title: node.title ?? null,
        issueNumber: Number(node.number) || 0,
        repository: {
          name: node.repository.name,
          owner: { login: node.repository.owner.login },
        },
        labels,
      });
    } catch (err) {
      context.logger.error("Failed to fetch current priority label", { issueId, err });
    }
  }

  return results;
}

export async function addLabelToIssue(context: Context, labelName: string) {
  const payload = context.payload;
  if (!("issue" in payload) || !payload.issue) {
    return;
  }

  try {
    await context.octokit.rest.issues.addLabels({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      labels: [labelName],
    });
  } catch (err: unknown) {
    throw context.logger.error("Adding a label to issue failed!", { err });
  }
}

export async function unassignLabelFromIssue(context: Context, owner: string, repo: string, issueNumber: number, labelName: string) {
  try {
    await context.octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: labelName,
    });
  } catch (err: unknown) {
    throw context.logger.error("Removing a label from an issue failed!", { err });
  }
}

export async function assignLabelToIssue(context: Context, owner: string, repo: string, issueNumber: number, labelName: string) {
  try {
    await context.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [labelName],
    });
  } catch (err: unknown) {
    throw context.logger.error("Adding a label from an issue failed!", { err });
  }
}

export function findLabels(labels: { name: string }[], regex: RegExp): { name: string } | undefined {
  return labels.find((label) => regex.test(label.name));
}
export async function removeAllTimeLabels(context: Context, labels: { name: string }[]) {
  const timeLabels = labels.filter((label) => TIME_REGEX.test(label.name));
  if (timeLabels.length === 0) return;

  for (const label of timeLabels) {
    await unassignLabelFromIssue(context, context.payload.repository.owner.login, context.payload.repository.name, context.payload.issue.number, label.name);
  }
}

export async function removeAllPriorityLabels(context: Context, labels: { name: string }[]) {
  const priorityLabels = labels.filter((label) => PRIORITY_REGEX.test(label.name));
  if (priorityLabels.length === 0) return;

  for (const label of priorityLabels) {
    await unassignLabelFromIssue(context, context.payload.repository.owner.login, context.payload.repository.name, context.payload.issue.number, label.name);
  }
}

export async function removeAllPricingLabels(context: Context, labels: { name: string }[]) {
  const pricingLabels = labels.filter((label) => label.name.startsWith("Price:"));
  if (pricingLabels.length === 0) return;

  for (const label of pricingLabels) {
    await unassignLabelFromIssue(context, context.payload.repository.owner.login, context.payload.repository.name, context.payload.issue.number, label.name);
  }
}
