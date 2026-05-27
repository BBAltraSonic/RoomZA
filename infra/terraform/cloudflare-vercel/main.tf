provider "cloudflare" {}
provider "vercel" {
  team = var.vercel_team_id
}

resource "cloudflare_ruleset" "baseline_waf" {
  zone_id     = var.cloudflare_zone_id
  name        = "RoomZA baseline WAF"
  description = "Managed rules and abuse controls for the public app."
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules = [
    {
      action = "execute"
      action_parameters = {
        id = "efb7b8c949ac4650a09736fc376e9aee"
      }
      expression  = "true"
      description = "Cloudflare Managed Ruleset"
      enabled     = true
    }
  ]
}

resource "cloudflare_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = true
}
