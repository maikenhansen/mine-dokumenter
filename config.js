/* Innstillinger for Mine dokumenter på GitHub.
   Feltene salt, iv, iter og data under hver bruker lages i oppsett.html. De inneholder GitHub-nøkkelen kryptert med brukerens passord. */
window.MD_CONFIG = {
  owner: "maikenhansen",            /* eieren av dokumentarkivet */
  repo: "mine-dokumenter-data",     /* det private arkivet der dokumentene lagres */
  branch: "main",
  sharedFolder: "Felles",           /* dokumenter i denne mappen ser alle brukerne */
  users: [
    {key: "maiken", name: "Maiken"},
    {key: "olav",   name: "Olav"}
  ]
};
