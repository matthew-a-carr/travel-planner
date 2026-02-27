terraform {
  required_version = ">= 1.9"

  # HCP Terraform workspace for the preview environment.
  # This workspace manages only the Neon preview database. The Vercel project
  # (which is shared across environments) is managed by environments/production.
  cloud {
    organization = "travel-planner" # Replace with your HCP Terraform organisation name

    workspaces {
      name = "travel-planner-preview"
    }
  }

  required_providers {
    neon = {
      source  = "kislydm/neon"
      version = "~> 0.13"
    }
  }
}
