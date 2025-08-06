import { RestEndpointMethodTypes } from "@octokit/rest";

export type Label = RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"][0];

export enum UserType {
  User = "User",
  Bot = "Bot",
}

export type GraphQlFetchPriorities = {
  node?: {
    title?: string;
    number: string;
    state: "OPEN" | "CLOSED";
    repository?: {
      name: string;
      owner: {
        login: string;
      };
    };
    labels?: {
      nodes: {
        name: string;
      }[];
    };
  };
};
