# 🌟 Injective Helix

_Helix | The Premier Decentralized Spot and Derivatives Exchange_

[Get a taste of the UI](https://helixapp.com)

## ✨ Features

- Modern and intuitive design
- Trade with ease and flexibility
- Latest development and security practices
- Awesome to use!

---

## 📚 Getting Started

1. Clone the repository

```bash
$ git clone git@github.com:InjectiveLabs/injective-dex.git
$ cd injective-dex
$ yarn
```

2. Duplicate the .env.example to .env and fill in the values
3. Compile the app locally

```bash
$ yarn dev
```

## 📖 Documentation

The `injective-dex` is built using Nuxt and TailwindCSS and its powered by the [injective-ts monorepo](https://github.com/InjectiveLabs/injective-ts/).

You can always boot the dex locally on your own laptop without having to set up a relayer. You can use the `public` network in your `APP_NETWORK` `.env` configuration variable and run the `yarn run dev` command. You can find all of the available networks (i.e - predefined set of endpoints) [here](https://github.com/InjectiveLabs/injective-ts/blob/17b1aa5df39d5724baf6262b276980cf722a1cba/packages/networks/src/types.ts#L1). Using these endpoints (from the `public`) network gives the 40% of the trading fees to the community spend pool.

### Deployment

The `injective-dex` uses AWS for deployment. There is a CD pipeline set in the `.github/workflow/deploy.yml` file. Deployment to AWS is done to a S3 bucket which is served through Cloudfront to the end user. Using `nuxt build && nuxt generate` we are generating static html pages that are served through cloud front.

The `injective-dex` can also be served as a SPA. To do this, you have to have a node server running and serve the `dist` folder that gets generated when you do the `yarn build` command.

More details about how to deploy a Nuxt project can be found on their docs.

---

## ⛑ Support

Reach out to us at one of the following places!

- Website at <a href="https://injective.com" target="_blank">`injective.com`</a>
- Website at <a href="https://injectivelabs.org" target="_blank">`injectivelabs.org`</a>
- Twitter at <a href="https://twitter.com/Injective_" target="_blank">`@Injective`</a>
- Twitter at <a href="https://twitter.com/InjectiveLabs" target="_blank">`@InjectiveLabs`</a>
- Discord at <a href="https://discord.com/invite/NK4qdbv" target="_blank">`Injective Discord`</a>
- Telegram at <a href="https://t.me/joininjective" target="_blank">`Injective Telegram`</a>
- Telegram at <a href="https://t.me/helixapp" target="_blank">`Helix Telegram`</a>

---

## 🔓 License

Copyright © 2021 - 2022 Injective Labs Inc. (https://injectivelabs.org/)

<a href="https://iili.io/mNneZN.md.png"><img src="https://iili.io/mNneZN.md.png" style="width: 300px; max-width: 100%; height: auto" />

Originally released by Injective Labs Inc. under: <br />
Apache License <br />
Version 2.0, January 2004 <br />
http://www.apache.org/licenses/

<p>&nbsp;</p>
<div align="center">
  <sub><em>Powering the future of decentralized finance.</em></sub>
</div>
