import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Page from './page'

describe('Home page', () => {
  it('renders a heading', () => {
    render(<Page />)
    expect(screen.getByText('Hello world!')).toBeDefined()
  })
})
