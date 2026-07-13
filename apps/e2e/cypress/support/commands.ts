Cypress.Commands.add('apiRequest', (endpoint: string) => {
  const apiUrl = Cypress.env('REST_API_URL')
  return cy.request(`${apiUrl}${endpoint}`)
})

declare global {
  namespace Cypress {
    interface Chainable {
      apiRequest: (endpoint: string) => Cypress.Chainable<Cypress.Response<unknown>>
    }
  }
}

export {}
