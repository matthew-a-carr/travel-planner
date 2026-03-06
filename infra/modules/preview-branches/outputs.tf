output "branch_ids" {
  description = "Neon branch IDs keyed by PR number."
  value = {
    for pr_number, branch in neon_branch.preview : pr_number => branch.id
  }
}

output "git_branch_names" {
  description = "Git branch names keyed by PR number."
  value = {
    for pr_number, preview in local.previews : pr_number => preview.git_branch_name
  }
}

output "postgres_urls" {
  description = "Preview POSTGRES_URL values keyed by PR number."
  value       = local.preview_postgres_urls
  sensitive   = true
}
