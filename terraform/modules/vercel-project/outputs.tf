output "project_url" {
  description = "The canonical Vercel deployment URL for this project."
  value       = "https://${vercel_project.this.name}.vercel.app"
}

output "project_id" {
  description = "The Vercel project ID."
  value       = vercel_project.this.id
}
