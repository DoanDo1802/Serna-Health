import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the accessible foundation status', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'MediCore foundation' })).toBeVisible()
    expect(screen.getByText(/No clinical workflow is active/)).toBeVisible()
  })
})
