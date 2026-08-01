<!-- https://docs.crazygames.com/resources/html5/sitelock/ -->

# Sitelock

Sitelock helps prevent your HTML5 game from being copied and hosted on unauthorized websites.

## Protecting HTML5 games

To prevent your game from being stolen by other websites, check whether the game is running on `crazygames.*` domains. This is an example domain that should support loading the game: `https://cubes-2048-io.game-files.crazygames.com/cubes-2048-io/13/index.html`

Your can use this function to ensure your game runs on valid CrazyGames domains.

```
function isCrazyGames() {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    const idx = parts.indexOf("crazygames");
    return idx !== -1 && idx >= parts.length - 3;
}
```

If this check fails, you can show a message such as "Available only on CrazyGames" or render a blank screen.

To improve sitelock robustness, you can obfuscate relevant parts of your game code with a tool like obfuscator.io.

## Protecting iframe games

To prevent iframe embedding, configure the CSP header:
`Content-Security-Policy: frame-ancestors [...]`

If you submit your game as an iframe game, keep in mind that CrazyGames has multiple regional domains (for example `www.crazygames.no`, `www.1001juegos.com`, `www.crazygames.fr`). You must whitelist all supported CrazyGames domains:

```
// General
*.crazygames.com
crazygames.*   // * can be a TLD consisting of 1 or 2 parts like .fr or .com.br

// Exhaustive list
www.crazygames.com
de.crazygames.com
it.crazygames.com
vn.crazygames.com
gr.crazygames.com
ar.crazygames.com
th.crazygames.com

www.crazygames.fr
www.crazygames.co.id
www.crazygames.cz
www.crazygames.dk
www.crazygames.hu
www.crazygames.nl
www.crazygames.no
www.crazygames.pl
www.crazygames.com.br
www.crazygames.ro
www.crazygames.fi
www.crazygames.se
www.crazygames.ru
www.crazygames.com.ua
www.crazygames.at
www.crazygames.jp
www.crazygames.pt
www.crazygames.vn
www.crazygames.com.vn
www.crazygames.co.kr

// video ads run on
games.crazygames.com

//deprecated domains (no longer need whitelisting)
www.1001juegos.com
tr.crazygames.com
```
