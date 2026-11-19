/* Innstillinger for Mine dokumenter på GitHub.
   Feltene salt, iv, iter og data under hver bruker lages i oppsett.html. De inneholder GitHub-nøkkelen kryptert med brukerens passord. */
window.MD_CONFIG = {
  owner: "maikenhansen",            /* eieren av dokumentarkivet */
  repo: "mine-dokumenter-data",     /* det private arkivet der dokumentene lagres */
  branch: "main",
  sharedFolders: ["Felles", "Operations"],   /* dokumenter i disse mappene ser og redigerer alle brukerne */
  users: [
    {
      "key": "maiken",
      "name": "Maiken",
      "salt": "qDbpYopy8dHYesXWG+eMoA==",
      "iv": "inlE40Y3fRamqSVY",
      "iter": 600000,
      "data": "RH3b65E3lDQfzTRx2hSfDNlmjkYN/GbE4InNJyzPRSk6//amwtUotyU3l8t7duspF1BevUgDZn3G5QDgL9k8EYhXEyAoevFfKbAXcvhdfxJMOUYna8RJAYKC4BlNkAQRFsdrM9YhFy7nEG1l/w=="
    },
    {
      "key": "olav",
      "name": "Olav",
      "salt": "igTDagaJKF/UTQeRYekKgA==",
      "iv": "Hg3Iy0tB+DkhG7IP",
      "iter": 600000,
      "data": "DVFHEF6j8IsaCRS3XuYfV8i5eApzK4eWorrdHo1A235ZgRs6sJXfhi/k8ZPXB8HmiyvatYJT8j7u5ohK/IMbKIX0fYwg34b2tg3BYiZQrlDhmG6LF9BmRNp4GrsC00HAQF5O9dzQT8AVS6SsJQ=="
    }
  ]
};
