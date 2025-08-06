import { SupabaseClient } from "@supabase/supabase-js";
import { SuperSupabase } from "./supabase";
import { Context } from "../../../types/context";

export interface IssueType {
  id: string;
  markdown?: string;
  author_id: number;
  created_at: string;
  modified_at: string;
  embedding: number[];
}

export interface IssueSimilaritySearchResult {
  id: string;
  issue_id: string;
  similarity: number;
}

export interface IssueData {
  markdown: string | null;
  id: string;
  author_id: number;
  payload: Record<string, unknown> | null;
  isPrivate: boolean;
}

interface FindSimilarIssuesParams {
  markdown: string;
  currentId: string;
  threshold: number;
  count: number;
}

export class Issue extends SuperSupabase {
  constructor(supabase: SupabaseClient, context: Context) {
    super(supabase, context);
  }

  async getIssue(issueNodeId: string): Promise<IssueType[] | null> {
    const { data, error } = await this.supabase.from("issues").select("*").eq("id", issueNodeId);
    if (error) {
      this.context.logger.error("Error getting issue", {
        Error: error,
        issueData: {
          id: issueNodeId,
        },
      });
      return null;
    }
    return data;
  }

  async findSimilarIssues({ markdown, currentId, threshold }: FindSimilarIssuesParams): Promise<IssueSimilaritySearchResult[] | null> {
    // Create a new issue embedding
    try {
      const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
      const { data, error } = await this.supabase.rpc("find_similar_issues_annotate", {
        query_embedding: embedding,
        current_id: currentId,
        threshold,
        top_k: 5,
      });
      if (error) {
        this.context.logger.error("Unable to find similar issues", {
          Error: error,
          markdown,
          currentId,
          threshold,
          query_embedding: embedding,
        });
        return null;
      }
      return data;
    } catch (error) {
      this.context.logger.error("Unable to find similar issues", {
        Error: error,
        markdown,
        currentId,
        threshold,
      });
      return null;
    }
  }

  async findSimilarIssuesToMatch({ markdown, currentId, threshold, count }: FindSimilarIssuesParams): Promise<IssueSimilaritySearchResult[] | null> {
    // Create a new issue embedding
    try {
      const embedding = await this.context.adapters.voyage.embedding.createEmbedding(markdown);
      const { data, error } = await this.supabase.rpc("find_similar_issues_to_match", {
        current_id: currentId,
        query_embedding: embedding,
        threshold,
        top_k: count,
      });
      if (error) {
        this.context.logger.error("Error finding similar issues", {
          Error: error,
          markdown,
          threshold,
          query_embedding: embedding,
        });
        return null;
      }
      return data;
    } catch (error) {
      this.context.logger.error("Error finding similar issues", {
        Error: error,
        markdown,
        threshold,
      });
      return null;
    }
  }
}
