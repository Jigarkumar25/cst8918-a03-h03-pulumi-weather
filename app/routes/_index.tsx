import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import type { LoaderFunctionArgs } from '@remix-run/node'

import { fetchWeatherData } from '~/api-services/open-weather-service'

export async function loader({ request }: LoaderFunctionArgs) {
  // NOTE: Use whatever lat/lon/units your project already uses.
  // These defaults are just to keep the sample working.
  const lat = 45.4215
  const lon = -75.6972
  const units = 'metric'

  try {
    const data = await fetchWeatherData({ lat, lon, units })
    return json({ currentConditions: data, error: null })
  } catch (err: any) {
    return json({
      currentConditions: null,
      error: err?.message ?? 'Failed to load weather data',
    })
  }
}

export default function CurrentConditions() {
  const { currentConditions, error } = useLoaderData<typeof loader>()

  // If API failed, show a friendly message instead of crashing
  if (error) {
    return (
      <main
        style={{
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: '1.8',
        }}
      >
        <h1>Weather App</h1>
        <p style={{ color: 'crimson' }}>Error: {error}</p>
        <p>
          Check that <code>WEATHER_API_KEY</code> is set and valid, and that Redis is running.
        </p>
      </main>
    )
  }

  // Extra safety (shouldn't happen if no error, but keeps SSR safe)
  if (!currentConditions) {
    return (
      <main
        style={{
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: '1.8',
        }}
      >
        <h1>Weather App</h1>
        <p>Loading...</p>
      </main>
    )
  }

  // ✅ This fixes your crash (no more [0] of undefined)
  const weather = currentConditions?.weather?.[0]

  return (
    <>
      <main
        style={{
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: '1.8',
        }}
      >
        <h1>Current Conditions</h1>

        {!weather ? (
          <p>Weather data unavailable.</p>
        ) : (
          <div>
            <p>
              <strong>{weather.main}</strong> — {weather.description}
            </p>
          </div>
        )}

        <pre style={{ marginTop: '1rem' }}>
          {JSON.stringify(currentConditions, null, 2)}
        </pre>
      </main>
    </>
  )
}
