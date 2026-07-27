<script setup>
import { useData } from 'vitepress'

const { data } = useData()
const contributors = data?.contributors || []
</script>

<style scoped>
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px;
  margin-top: 32px;
}

.contributor-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
}

.contributor-card:hover {
  border-color: var(--vp-c-brand);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.contributor-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 12px;
}

.contributor-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--vp-c-text-1);
}

.contributor-contributions {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin-top: 4px;
}
</style>

# Team

SMM is built by a community of contributors. This page lists everyone who has contributed to the project on GitHub.

<div v-if="contributors.length" class="team-grid">
  <a
    v-for="contributor in contributors"
    :key="contributor.login"
    :href="contributor.html_url"
    target="_blank"
    rel="noopener noreferrer"
    class="contributor-card"
  >
    <img
      :src="contributor.avatar_url"
      :alt="contributor.login"
      class="contributor-avatar"
      loading="lazy"
    />
    <span class="contributor-name">{{ contributor.login }}</span>
    <span class="contributor-contributions">
      {{ contributor.contributions }} {{ contributor.contributions === 1 ? 'contribution' : 'contributions' }}
    </span>
  </a>
</div>

<p v-else>
  Unable to load contributors at this moment. Please check the
  <a href="https://github.com/Side-Projects-4-Fun/software-metrics-machine/graphs/contributors" target="_blank" rel="noopener noreferrer">
    GitHub contributors page
  </a>.
</p>
