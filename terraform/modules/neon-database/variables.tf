variable "project_name" {
  description = "Name of the Neon project to create."
  type        = string
}

variable "database_name" {
  description = "Name of the default database provisioned on the project's main branch."
  type        = string
  default     = "travel_planner"
}

variable "role_name" {
  description = "Name of the default role (database owner) provisioned on the project's main branch."
  type        = string
  default     = "travel_planner_owner"
}

variable "region_id" {
  description = "Neon region ID. Format: aws-<region>. See https://api.neon.tech/v2/regions for the full list."
  type        = string
  default     = "aws-eu-west-2" # London
}

variable "pg_version" {
  description = "PostgreSQL major version."
  type        = number
  default     = 16
}
