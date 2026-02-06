import { redis } from '~/utils/redis-connection.server'

const API_KEY = process.env.WEATHER_API_KEY
const TEN_MINUTES_MS = 1000 * 60 * 10

interface FetchWeatherDataParams {
  lat: number
  lon: number
  units: string
}

export async function fetchWeatherData({ lat, lon, units }: FetchWeatherDataParams) {
  if (!API_KEY) {
    throw new Error('WEATHER_API_KEY is not set')
  }

  const baseURL = 'https://api.openweathermap.org/data/2.5/weather'
  const cacheKey = `lat=${lat}&lon=${lon}&units=${units}`

  // 1) Cache hit
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // 2) Fetch from API
  const response = await fetch(`${baseURL}?${cacheKey}&appid=${API_KEY}`)
  const dataText = await response.text()

  // 3) If API failed, throw a useful error (instead of returning weird object)
  if (!response.ok) {
    throw new Error(`OpenWeather error ${response.status}: ${dataText}`)
  }

  // 4) Cache + return
  await redis.set(cacheKey, dataText, { PX: TEN_MINUTES_MS })
  return JSON.parse(dataText)
}

export async function getGeoCoordsForPostalCode(postalCode: string, countryCode: string) {
  if (!API_KEY) {
    throw new Error('WEATHER_API_KEY is not set')
  }

  const url = `http://api.openweathermap.org/geo/1.0/zip?zip=${postalCode},${countryCode}&appid=${API_KEY}`
  const response = await fetch(url)
  const dataText = await response.text()

  if (!response.ok) {
    throw new Error(`OpenWeather GEO error ${response.status}: ${dataText}`)
  }

  return JSON.parse(dataText)
}
