variable "team_id" {
  description = "Optional Vercel team ID. Leave null for personal account scope."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Vercel project name."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository slug in owner/repo format."
  type        = string
}

variable "production_branch" {
  description = "Git branch that maps to Vercel production deployments."
  type        = string
  default     = "main"
}

variable "framework" {
  description = "Vercel framework preset."
  type        = string
  default     = "nextjs"
}

variable "build_command" {
  description = "Project build command executed by Vercel."
  type        = string
}

variable "domain" {
  description = "Optional production domain to assign to the Vercel project."
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Environment variables to set on the project."
  type = list(object({
    key                    = string
    value                  = string
    target                 = optional(set(string))
    custom_environment_ids = optional(set(string))
    git_branch             = optional(string)
    sensitive              = optional(bool)
    comment                = optional(string)
  }))
  default = []
}
