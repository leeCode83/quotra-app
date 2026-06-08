import fs from "fs";


const envStr = fs.readFileSync(".env", "utf8");
const env: Record<string, string> = {};
envStr.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
});

async function main() {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const json = await res.json();
  const table = json.definitions.consumer_permissions;
  console.log("consumer_permissions schema:", table.properties);
}
main();
