terraform {
  required_version = ">= 1.9"

  # HCP Terraform (Terraform Cloud) free tier — remote state + VCS-driven
  # plan/apply workflow. Replaces Atlantis without any persistent server.
  # Set up: https://app.terraform.io → create org → create workspace
  # "travel-planner-production" connected to this repo's terraform/environments/production/ path.
  cloud {
    organization = "travel-planner" # Replace with your HCP Terraform organisation name

    workspaces {
      name = "travel-planner-production"
    }
  }

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.13"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
