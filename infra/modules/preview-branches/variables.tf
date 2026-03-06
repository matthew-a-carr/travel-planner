variable "project_id" {
  description = "Neon project ID for preview infrastructure."
  type        = string
}

variable "open_previews" {
  description = "Map of open PR numbers to Git branch names."
  type        = map(string)
  default     = {}
}

variable "database_name" {
  description = "Database name to create in each preview branch."
  type        = string
  default     = "travel_planner"
}

variable "endpoint_type" {
  description = "Endpoint type for preview branches."
  type        = string
  default     = "read_write"
}
