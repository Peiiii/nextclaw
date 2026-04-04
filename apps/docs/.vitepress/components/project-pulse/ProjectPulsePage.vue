<script setup lang="ts">
import { computed } from 'vue'

import pulseData from '../../data/project-pulse.generated.mjs'
import ProjectPulseBarList from './ProjectPulseBarList.vue'
import ProjectPulseTrendChart from './ProjectPulseTrendChart.vue'
import { projectPulseCopy } from './project-pulse-copy'
import './project-pulse.css'

const props = defineProps<{
  locale: 'en' | 'zh'
}>()

const t = computed(() => projectPulseCopy[props.locale])

const heroStats = computed(() => [
  {
    label: t.value.stats.loc,
    value: pulseData.hero.currentLoc.toLocaleString(),
    meta: `${pulseData.hero.trackedFiles.toLocaleString()} ${t.value.filesSuffix}`
  },
  {
    label: t.value.stats.commits,
    value: pulseData.hero.recentCommitCount.toLocaleString(),
    meta: t.value.activeDays.replace('{count}', pulseData.hero.activeDays30.toLocaleString())
  },
  {
    label: t.value.stats.releases,
    value: pulseData.hero.recentReleaseCount.toLocaleString(),
    meta: pulseData.hero.latestReleaseDate
  },
  {
    label: t.value.stats.note,
    value: pulseData.hero.latestNoteDate || 'N/A',
    meta: pulseData.timeline.notes[0]?.[props.locale].title ?? ''
  },
  {
    label: t.value.stats.benchmark,
    value: `${pulseData.hero.basePercentOfBenchmark}%`,
    meta: t.value
      .benchmarkLine
      .replace('{name}', pulseData.hero.benchmarkName)
      .replace('{percent}', pulseData.hero.basePercentOfBenchmark.toLocaleString())
  }
])

const scopeItems = computed(() =>
  pulseData.breakdown.topScopes.map((scope) => ({
    name: scope.name,
    value: scope.codeLines,
    meta:
      props.locale === 'zh'
        ? `${scope.sharePercent}% · ${scope.files.toLocaleString()} 个文件`
        : `${scope.sharePercent}% · ${scope.files.toLocaleString()} files`
  }))
)

const benchmarkSummary = computed(() => [
  t.value
    .benchmarkLine
    .replace('{name}', pulseData.breakdown.benchmark.name)
    .replace('{percent}', pulseData.breakdown.benchmark.basePercentOfBenchmark.toLocaleString()),
  t.value.lighterLine.replace('{percent}', pulseData.breakdown.benchmark.lighterByPercent.toLocaleString())
])

const releaseBatches = computed(() =>
  pulseData.breakdown.recentReleaseBatches.map((batch) => ({
    ...batch,
    summary:
      props.locale === 'zh'
        ? `${batch.tagCount.toLocaleString()} ${t.value.releaseCountSuffix}`
        : `${batch.tagCount.toLocaleString()} ${t.value.releaseCountSuffix}`
  }))
)

const notes = computed(() =>
  pulseData.timeline.notes.map((item) => ({
    date: item.date,
    title: item[props.locale].title,
    description: item[props.locale].description,
    href: item[props.locale].href,
    tags: item.tags
  }))
)

const gallery = computed(() =>
  pulseData.gallery.items.map((item) => ({
    key: item.key,
    title: item.title[props.locale],
    description: item.description[props.locale],
    image: item.images[props.locale] ?? item.images.en ?? item.images.zh ?? ''
  }))
)
</script>

<template>
  <div class="project-pulse">
    <section class="project-pulse__hero">
      <div class="project-pulse__hero-copy">
        <p class="project-pulse__eyebrow">{{ t.eyebrow }}</p>
        <h1>{{ t.title }}</h1>
        <p class="project-pulse__summary">{{ t.summary }}</p>
        <p class="project-pulse__caption">{{ t.heroCaption }}</p>
      </div>

      <div class="project-pulse__stats">
        <article v-for="stat in heroStats" :key="stat.label" class="project-pulse__stat-card">
          <span class="project-pulse__stat-label">{{ stat.label }}</span>
          <strong class="project-pulse__stat-value">{{ stat.value }}</strong>
          <span class="project-pulse__stat-meta">{{ stat.meta }}</span>
        </article>
      </div>
    </section>

    <section class="project-pulse__section">
      <div class="project-pulse__section-head">
        <p>{{ t.sections.trends }}</p>
        <span>{{ t.updatedOn }} {{ pulseData.generatedAt.slice(0, 10) }}</span>
      </div>

      <div class="project-pulse__trend-grid">
        <article class="project-pulse__panel">
          <div class="project-pulse__panel-head">
            <div>
              <h2>{{ t.cards.loc.title }}</h2>
              <p>{{ t.cards.loc.description }}</p>
            </div>
            <strong>{{ pulseData.hero.currentLoc.toLocaleString() }}</strong>
          </div>
          <ProjectPulseTrendChart
            chart-id="loc-trend"
            :series="pulseData.trends.locDaily"
            accent-start="#f97316"
            accent-end="#f2c94c"
          />
        </article>

        <article class="project-pulse__panel">
          <div class="project-pulse__panel-head">
            <div>
              <h2>{{ t.cards.commits.title }}</h2>
              <p>{{ t.cards.commits.description }}</p>
            </div>
            <strong>{{ pulseData.hero.recentCommitCount.toLocaleString() }}</strong>
          </div>
          <ProjectPulseTrendChart
            chart-id="commit-trend"
            :series="pulseData.trends.commitWeekly"
            accent-start="#0ea5a4"
            accent-end="#38bdf8"
          />
        </article>

        <article class="project-pulse__panel">
          <div class="project-pulse__panel-head">
            <div>
              <h2>{{ t.cards.releases.title }}</h2>
              <p>{{ t.cards.releases.description }}</p>
            </div>
            <strong>{{ pulseData.hero.recentReleaseCount.toLocaleString() }}</strong>
          </div>
          <ProjectPulseTrendChart
            chart-id="release-trend"
            :series="pulseData.trends.releaseMonthly"
            accent-start="#2563eb"
            accent-end="#34d399"
          />
        </article>
      </div>
    </section>

    <section class="project-pulse__section">
      <div class="project-pulse__section-head">
        <p>{{ t.sections.structure }}</p>
        <span>{{ pulseData.meta.locProfile }}</span>
      </div>

      <div class="project-pulse__two-column">
        <article class="project-pulse__panel">
          <div class="project-pulse__panel-head project-pulse__panel-head--stack">
            <div>
              <h2>{{ t.cards.scopes.title }}</h2>
              <p>{{ t.cards.scopes.description }}</p>
            </div>
          </div>
          <ProjectPulseBarList :items="scopeItems" />
        </article>

        <div class="project-pulse__stack">
          <article class="project-pulse__panel project-pulse__panel--accent">
            <div class="project-pulse__panel-head project-pulse__panel-head--stack">
              <div>
                <h2>{{ t.cards.benchmark.title }}</h2>
                <p>{{ t.cards.benchmark.description }}</p>
              </div>
            </div>
            <div class="project-pulse__benchmark">
              <strong>{{ pulseData.breakdown.benchmark.basePercentOfBenchmark }}%</strong>
              <p v-for="line in benchmarkSummary" :key="line">{{ line }}</p>
            </div>
          </article>

          <article class="project-pulse__panel">
            <div class="project-pulse__panel-head project-pulse__panel-head--stack">
              <div>
                <h2>{{ t.cards.releaseBatches.title }}</h2>
                <p>{{ t.cards.releaseBatches.description }}</p>
              </div>
            </div>
            <div class="project-pulse__release-list">
              <div v-for="batch in releaseBatches" :key="batch.date" class="project-pulse__release-item">
                <div class="project-pulse__release-top">
                  <strong>{{ batch.date }}</strong>
                  <span>{{ batch.summary }}</span>
                </div>
                <p>{{ batch.sampleTags.join(' · ') }}</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="project-pulse__section">
      <div class="project-pulse__section-head">
        <p>{{ t.sections.timeline }}</p>
        <span>{{ pulseData.meta.sourceCount.notes }} notes</span>
      </div>
      <article class="project-pulse__panel">
        <div class="project-pulse__panel-head project-pulse__panel-head--stack">
          <div>
            <h2>{{ t.cards.timeline.title }}</h2>
            <p>{{ t.cards.timeline.description }}</p>
          </div>
        </div>
        <div class="project-pulse__timeline">
          <a v-for="item in notes" :key="item.href" class="project-pulse__timeline-item" :href="item.href">
            <span class="project-pulse__timeline-date">{{ item.date }}</span>
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
            <div class="project-pulse__tags">
              <span>{{ t.tags }}</span>
              <code v-for="tag in item.tags" :key="tag">{{ tag }}</code>
            </div>
          </a>
        </div>
      </article>
    </section>

    <section class="project-pulse__section">
      <div class="project-pulse__section-head">
        <p>{{ t.sections.gallery }}</p>
        <span>{{ t.screenshotRefresh }} {{ pulseData.gallery.refreshedAt }}</span>
      </div>
      <article class="project-pulse__panel">
        <div class="project-pulse__panel-head project-pulse__panel-head--stack">
          <div>
            <h2>{{ t.cards.gallery.title }}</h2>
            <p>{{ t.cards.gallery.description }}</p>
          </div>
        </div>
        <div class="project-pulse__gallery">
          <figure v-for="item in gallery" :key="item.key" class="project-pulse__shot">
            <img :src="item.image" :alt="item.title" loading="lazy" />
            <figcaption>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </figcaption>
          </figure>
        </div>
      </article>
    </section>

    <section class="project-pulse__section project-pulse__section--trust">
      <div class="project-pulse__section-head">
        <p>{{ t.sections.trust }}</p>
        <span>{{ pulseData.meta.locGeneratedAt.slice(0, 10) }}</span>
      </div>
      <article class="project-pulse__panel">
        <ul class="project-pulse__trust-list">
          <li v-for="item in t.trustPoints" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>
  </div>
</template>
