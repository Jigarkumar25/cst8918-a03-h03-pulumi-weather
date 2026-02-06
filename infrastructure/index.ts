import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";
import { Image } from "@pulumi/docker-build";

// --------------------
// Read config
// --------------------
const cfg = new pulumi.Config();

const appPath = cfg.get("appPath") ?? "..";
const prefixName = cfg.require("prefixName"); // cst8918-a03-pate1595
const imageTag = cfg.get("imageTag") ?? "v1";

const containerPort = cfg.getNumber("containerPort") ?? 3000;
const publicPort = cfg.getNumber("publicPort") ?? 3000;

const cpu = cfg.getNumber("cpu") ?? 1;
const memory = cfg.getNumber("memory") ?? 1.5;

const weatherApiKey = cfg.require("weatherApiKey");

// --------------------
// Resource Group
// --------------------
const rg = new azure.resources.ResourceGroup(`${prefixName}-rg`, {
    resourceGroupName: `${prefixName}-rg`,
});

// --------------------
// Azure Container Registry
// --------------------
const acr = new azure.containerregistry.Registry(`${prefixName}acr`, {
    resourceGroupName: rg.name,
    registryName: `${prefixName}acr`
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .slice(0, 50),
    sku: { name: "Basic" },
    adminUserEnabled: true,
});

const acrCreds = pulumi
    .all([rg.name, acr.name])
    .apply(([resourceGroupName, registryName]) =>
        azure.containerregistry.listRegistryCredentials({
            resourceGroupName,
            registryName,
        })
    );

const acrUsername = acrCreds.apply((c) => c.username ?? "");
const acrPassword = acrCreds.apply((c) => c.passwords?.[0]?.value ?? "");
const acrServer = acr.loginServer;

// --------------------
// Build & Push Docker Image
// --------------------
const imageName = pulumi.interpolate`${acrServer}/${prefixName}:${imageTag}`;

const appImage = new Image(`${prefixName}-image`, {
    context: {
        location: appPath,
    },
    tags: [imageName],
    push: true,
    registries: [
        {
            address: acrServer,
            username: acrUsername,
            password: pulumi.secret(acrPassword),
        },
    ],
});

// --------------------
// Azure Container Instance
// --------------------
const dnsLabel = `${prefixName}-${pulumi.getStack()}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 58);

const cg = new azure.containerinstance.ContainerGroup(`${prefixName}-aci`, {
    resourceGroupName: rg.name,
    containerGroupName: `${prefixName}-aci`,
    osType: "Linux",

    ipAddress: {
        type: "Public",
        ports: [{ port: publicPort, protocol: "TCP" }],
        dnsNameLabel: dnsLabel,
    },

    // ✅ THIS FIXES THE 401 (ACI pulling from private ACR)
    imageRegistryCredentials: [
        {
            server: acrServer,
            username: acrUsername,
            password: pulumi.secret(acrPassword),
        },
    ],

    containers: [
        {
            name: "weather-app",
            image: appImage.ref,
            ports: [{ port: publicPort }],
            resources: {
                requests: {
                    cpu,
                    memoryInGB: memory,
                },
            },
            environmentVariables: [
                { name: "PORT", value: String(publicPort) },
                { name: "WEATHER_API_KEY", value: weatherApiKey },
            ],
        },
    ],
});


// --------------------
// Outputs
// --------------------
export const resourceGroupName = rg.name;
export const acrLoginServer = acr.loginServer;
export const image = imageName;

export const ip = cg.ipAddress.apply((x) => x?.ip ?? "");
export const hostname = cg.ipAddress.apply((x) => x?.fqdn ?? "");
export const url = cg.ipAddress.apply((x) =>
    x?.fqdn ? `http://${x.fqdn}:${publicPort}` : ""
);
