export type FetchedPriorities = {
  issueId: string;
  priority: string;
  issueNumber: number;
  title: string | null;
  repository: { name: string; owner: { login: string } };
  labels: { name: string }[];
};
