#!/bin/bash

pnpm run lint
pnpm run build
pnpm run test
pnpm run coverage:all

pnpm run test:cli:acceptance
pnpm run webapp:e2e