describe('Health & Smoke', () => {
  it('REST API responds with health or configuration', () => {
    cy.apiRequest('/configuration').then((res) => {
      expect(res.status).to.eq(200)
    })
  })

  it('REST API exposes projects endpoint', () => {
    cy.apiRequest('/projects').then((res) => {
      expect(res.status).to.eq(200)
    })
  })

  it('webapp loads the homepage', () => {
    cy.visit('/')
    cy.title().should('not.be.empty')
    cy.document().its('body').should('not.be.empty')
  })

  it('webapp page does not throw server error', () => {
    cy.request({ url: '/', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.be.lessThan(500)
    })
  })
})
