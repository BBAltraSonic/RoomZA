variable "cloudflare_zone_id" {
  description = "Existing Cloudflare zone id for roomza.co.za."
  type        = string
}

variable "domain_name" {
  description = "Primary production hostname."
  type        = string
  default     = "roomza.co.za"
}

variable "vercel_project_name" {
  description = "Vercel project name."
  type        = string
  default     = "roomza"
}

variable "vercel_team_id" {
  description = "Optional Vercel team id."
  type        = string
  default     = null
}
