terraform {
  required_version = "~> 1.12.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.6.0"
    }

    neon = {
      source  = "kislerdm/neon"
      version = "= 0.13.0"
    }

    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14"
    }
  }

  backend "remote" {}
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "sentry" {
  token = var.sentry_auth_token
}
