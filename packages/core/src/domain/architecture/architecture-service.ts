import { Logger } from '@smmachine/utils';
import * as fs from 'fs/promises';
import { Dirent } from 'fs';
import * as path from 'path';
import { Commit } from '../../domain-types';
import { Configuration } from '../../infrastructure';
import { RepositoryFactory } from '../../infrastructure';
import {
  createPathMatchers,
  matchesAnyPathPattern,
  matchesIncludePatterns,
} from '../code/pattern-filters';
import {
  ArchitectureNode,
  ArchitectureRelationship,
  ArchitectureSnapshot,
  ArchitectureSnapshotHeader,
  ArchitectureView,
  ArchitectureViewLevel,
  GenerateArchitectureOptions,
} from './types';
import { GitFactory } from '../code/git/git-factory';

type ViewFilterOptions = {
  ignorePatterns?: string | string[];
  includePatterns?: string | string[];
};

type PackageJson = {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type DiscoveredPackage = {
  id: string;
  name: string;
  description?: string;
  technology: string;
  packagePath: string;
  dependencies: string[];
  components: string[];
  sourceFiles: SourceFile[];
};

type SourceFile = {
  relativePath: string;
  imports: string[];
};

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
]);

export class ArchitectureService {
  private readonly snapshotRepositoryPath: string;

  constructor(
    private readonly configuration: Configuration,
    private readonly logger: Logger
  ) {
    this.snapshotRepositoryPath = path.join(
      this.configuration.getArchitecturePath(),
      'snapshots.json'
    );
  }

  async generateSnapshot(options: GenerateArchitectureOptions = {}): Promise<ArchitectureSnapshot> {
    const gitFactory = GitFactory.create(this.configuration, this.logger);
    const commits = await gitFactory.fetchCommits({
      startDate: options.startDate,
      endDate: options.endDate,
      forceRefresh: options.refreshGit,
      maxBuffer: options.maxBuffer,
    });

    const discoveredPackages = await this.discoverPackages();
    const containerView = this.buildContainerView(discoveredPackages);
    const contextView = this.buildContextView(containerView.nodes, commits);
    const componentView = this.buildComponentView(discoveredPackages);
    const codeView = this.buildCodeView(discoveredPackages);

    const snapshot: ArchitectureSnapshot = {
      snapshotId: this.createSnapshotId(),
      generatedAt: new Date().toISOString(),
      project: this.configuration.githubRepository || 'unknown-project',
      branch: this.configuration.mainBranch,
      commitCount: commits.length,
      views: [contextView, containerView, componentView, codeView],
    };

    const current = await this.loadSnapshots();
    current.unshift(snapshot);
    await this.saveSnapshots(current);

    return snapshot;
  }

  async listSnapshots(): Promise<ArchitectureSnapshotHeader[]> {
    const snapshots = await this.loadSnapshots();
    return snapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      generatedAt: snapshot.generatedAt,
      project: snapshot.project,
      branch: snapshot.branch,
      commitCount: snapshot.commitCount,
      availableViews: snapshot.views.map((view) => view.level),
    }));
  }

  async getSnapshot(snapshotId?: string): Promise<ArchitectureSnapshot | null> {
    const snapshots = await this.loadSnapshots();
    if (!snapshots.length) {
      return null;
    }

    if (!snapshotId) {
      return snapshots[0] || null;
    }

    return snapshots.find((snapshot) => snapshot.snapshotId === snapshotId) || null;
  }

  async getView(
    level: ArchitectureViewLevel,
    snapshotId?: string,
    filterOptions?: ViewFilterOptions
  ): Promise<ArchitectureView | null> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) {
      return null;
    }

    const selectedView = snapshot.views.find((view) => view.level === level) || null;
    if (!selectedView) {
      return null;
    }

    const includeMatchers = createPathMatchers(filterOptions?.includePatterns, {
      splitOnNewline: true,
    });
    const ignoreMatchers = createPathMatchers(filterOptions?.ignorePatterns, {
      splitOnNewline: true,
    });

    if (includeMatchers.length === 0 && ignoreMatchers.length === 0) {
      return selectedView;
    }

    const codeView = snapshot.views.find((view) => view.level === 'code') || null;
    const matchedFiles = new Set<string>();

    if (codeView) {
      for (const node of codeView.nodes) {
        if (node.kind !== 'code') {
          continue;
        }

        const filePath = node.name;
        if (!matchesIncludePatterns(filePath, includeMatchers)) {
          continue;
        }
        if (matchesAnyPathPattern(filePath, ignoreMatchers)) {
          continue;
        }

        matchedFiles.add(filePath);
      }
    }

    const shouldKeepNode = (node: ArchitectureNode): boolean => {
      if (node.kind === 'person' || node.kind === 'system') {
        return true;
      }

      if (node.kind === 'code') {
        return matchedFiles.has(node.name);
      }

      if (!node.tags || node.tags.length === 0) {
        return true;
      }

      const filePrefixes = node.tags
        .filter((tag) => tag.startsWith('filePrefix:'))
        .map((tag) => tag.slice('filePrefix:'.length));

      if (filePrefixes.length === 0) {
        return true;
      }

      for (const filePath of matchedFiles) {
        if (filePrefixes.some((prefix) => filePath.startsWith(prefix))) {
          return true;
        }
      }

      return false;
    };

    const keptNodes = selectedView.nodes.filter(shouldKeepNode);
    const keptNodeIds = new Set(keptNodes.map((node) => node.id));
    const keptEdges = selectedView.edges.filter(
      (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
    );

    return {
      ...selectedView,
      nodes: keptNodes,
      edges: keptEdges,
    };
  }

  private async loadSnapshots(): Promise<ArchitectureSnapshot[]> {
    const snapshotsJsonRepository = RepositoryFactory.create<ArchitectureSnapshot[]>(
      this.snapshotRepositoryPath,
      this.logger,
      this.configuration
    );
    return (await snapshotsJsonRepository.load()) || [];
  }

  private async saveSnapshots(snapshots: ArchitectureSnapshot[]): Promise<void> {
    const snapshotsJsonRepository = RepositoryFactory.create<ArchitectureSnapshot[]>(
      this.snapshotRepositoryPath,
      this.logger,
      this.configuration
    );
    await snapshotsJsonRepository.save(snapshots);
  }

  private async discoverPackages(): Promise<DiscoveredPackage[]> {
    const repositoryRoot = this.configuration.gitRepositoryLocation;
    if (!repositoryRoot) {
      throw new Error('GIT_REPOSITORY_LOCATION is required for architecture generation');
    }

    const packageFiles = await this.findPackageJsonFiles(repositoryRoot, 0, 5);
    const found: DiscoveredPackage[] = [];

    for (const packageFile of packageFiles) {
      const parsed = await this.readPackageJson(packageFile);
      if (!parsed) {
        continue;
      }

      const packagePath = path.dirname(packageFile);
      const packagePathAbsolute = packagePath;
      const relativePath = path.relative(repositoryRoot, packagePath) || '.';
      const deps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };
      const sourceFiles = await this.discoverSourceFiles(packagePathAbsolute, repositoryRoot);
      const components = this.deriveComponents(sourceFiles);

      found.push({
        id: this.toId(parsed.name || relativePath),
        name: parsed.name || relativePath,
        description: parsed.description,
        technology: this.detectTechnology(parsed, relativePath),
        packagePath: relativePath,
        dependencies: Object.keys(deps),
        components,
        sourceFiles,
      });
    }

    return found;
  }

  private async findPackageJsonFiles(
    currentDirectory: string,
    currentDepth: number,
    maxDepth: number
  ): Promise<string[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      return [];
    }

    const packageFiles: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        const nested = await this.findPackageJsonFiles(
          path.join(currentDirectory, entry.name),
          currentDepth + 1,
          maxDepth
        );
        packageFiles.push(...nested);
        continue;
      }

      if (entry.isFile() && entry.name === 'package.json') {
        packageFiles.push(path.join(currentDirectory, entry.name));
      }
    }

    return packageFiles;
  }

  private async readPackageJson(filePath: string): Promise<PackageJson | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch {
      this.logger.warn(`Failed to parse package file ${filePath}`);
      return null;
    }
  }

  private buildContainerView(discoveredPackages: DiscoveredPackage[]): ArchitectureView {
    const nodeByName = new Map<string, ArchitectureNode>();

    const nodes = discoveredPackages.map((pkg) => {
      const node: ArchitectureNode = {
        id: `container:${pkg.id}`,
        kind: 'container',
        name: pkg.name,
        description: pkg.description || `Container at ${pkg.packagePath}`,
        technology: pkg.technology,
        tags: [`filePrefix:${pkg.packagePath}/src/`],
      };

      nodeByName.set(pkg.name, node);
      return node;
    });

    const edges: ArchitectureRelationship[] = [];
    const added = new Set<string>();

    for (const pkg of discoveredPackages) {
      const source = nodeByName.get(pkg.name);
      if (!source) {
        continue;
      }

      for (const dep of pkg.dependencies) {
        const target = nodeByName.get(dep);
        if (!target) {
          continue;
        }

        const edgeId = `${source.id}->${target.id}`;
        if (added.has(edgeId)) {
          continue;
        }

        added.add(edgeId);
        edges.push({
          id: `rel:${this.toId(edgeId)}`,
          source: source.id,
          target: target.id,
          kind: 'uses',
          description: `${source.name} depends on ${target.name}`,
          confidence: 0.95,
          evidence: {
            symbols: [dep],
          },
        });
      }
    }

    return {
      id: 'container',
      level: 'container',
      title: 'Container View',
      nodes,
      edges,
    };
  }

  private buildContextView(
    containerNodes: ArchitectureNode[],
    commits: Commit[]
  ): ArchitectureView {
    const developerNode: ArchitectureNode = {
      id: 'person:developer',
      kind: 'person',
      name: 'Developer',
      description: 'Runs CLI and explores architecture in dashboard',
    };

    const targetSystemNode: ArchitectureNode = {
      id: 'system:target-repository',
      kind: 'system',
      name: this.configuration.githubRepository || 'Target Repository',
      description: `Analyzed repository with ${commits.length} commits considered`,
      technology: 'Git',
    };

    const restLike = containerNodes.find((node) => node.name.includes('rest'));
    const cliLike = containerNodes.find((node) => node.name.includes('cli'));
    const webLike = containerNodes.find((node) => node.name.includes('web'));

    const contextNodes: ArchitectureNode[] = [developerNode, targetSystemNode, ...containerNodes];
    const edges: ArchitectureRelationship[] = [];

    if (cliLike) {
      edges.push({
        id: 'rel:developer-cli',
        source: developerNode.id,
        target: cliLike.id,
        kind: 'uses',
        description: 'Generates architecture snapshots',
        confidence: 1,
      });
      edges.push({
        id: 'rel:cli-target',
        source: cliLike.id,
        target: targetSystemNode.id,
        kind: 'uses',
        description: 'Reads source and git history',
        confidence: 0.9,
      });
    }

    if (webLike) {
      edges.push({
        id: 'rel:developer-web',
        source: developerNode.id,
        target: webLike.id,
        kind: 'uses',
        description: 'Visualizes architecture',
        confidence: 1,
      });
    }

    if (webLike && restLike) {
      edges.push({
        id: 'rel:web-rest',
        source: webLike.id,
        target: restLike.id,
        kind: 'uses',
        description: 'Reads architecture snapshots',
        confidence: 0.85,
      });
    }

    return {
      id: 'context',
      level: 'context',
      title: 'System Context View',
      nodes: contextNodes,
      edges,
    };
  }

  private buildComponentView(discoveredPackages: DiscoveredPackage[]): ArchitectureView {
    const nodes: ArchitectureNode[] = [];
    const edges: ArchitectureRelationship[] = [];
    const componentNodeByKey = new Map<string, ArchitectureNode>();

    for (const pkg of discoveredPackages) {
      const containerId = `container:${pkg.id}`;
      const containerNode: ArchitectureNode = {
        id: containerId,
        kind: 'container',
        name: pkg.name,
        technology: pkg.technology,
        description: `Container ${pkg.name}`,
      };
      nodes.push(containerNode);

      for (const componentName of pkg.components) {
        const componentId = `component:${pkg.id}:${this.toId(componentName)}`;
        const componentNode: ArchitectureNode = {
          id: componentId,
          kind: 'component',
          name: `${pkg.name}::${componentName}`,
          technology: 'TypeScript module',
          description: `Component ${componentName} in ${pkg.name}`,
          tags: [
            `filePrefix:${pkg.packagePath}/src/${componentName}/`,
            `filePrefix:${pkg.packagePath}/src/${componentName}.`,
            `filePrefix:${pkg.packagePath}/src/`,
          ],
        };
        nodes.push(componentNode);
        componentNodeByKey.set(`${pkg.name}:${componentName}`, componentNode);

        edges.push({
          id: `rel:${this.toId(`${containerId}-${componentId}`)}`,
          source: containerId,
          target: componentId,
          kind: 'uses',
          description: 'Contains component',
          confidence: 0.95,
        });
      }
    }

    for (const pkg of discoveredPackages) {
      for (const sourceFile of pkg.sourceFiles) {
        const sourceComponent = this.componentNameFromFilePath(sourceFile.relativePath);
        const sourceNode = componentNodeByKey.get(`${pkg.name}:${sourceComponent}`);
        if (!sourceNode) {
          continue;
        }

        for (const importPath of sourceFile.imports) {
          if (!importPath.startsWith('.')) {
            continue;
          }

          const targetComponent = this.componentNameFromImportPath(
            sourceFile.relativePath,
            importPath
          );
          const targetNode = componentNodeByKey.get(`${pkg.name}:${targetComponent}`);
          if (!targetNode || targetNode.id === sourceNode.id) {
            continue;
          }

          const edgeKey = `${sourceNode.id}->${targetNode.id}`;
          if (edges.some((existing) => existing.id === `rel:${this.toId(edgeKey)}`)) {
            continue;
          }

          edges.push({
            id: `rel:${this.toId(edgeKey)}`,
            source: sourceNode.id,
            target: targetNode.id,
            kind: 'uses',
            description: 'Component dependency inferred from imports',
            confidence: 0.7,
            evidence: {
              files: [sourceFile.relativePath],
              symbols: [importPath],
            },
          });
        }
      }
    }

    return {
      id: 'component',
      level: 'component',
      title: 'Component View',
      nodes,
      edges,
    };
  }

  private buildCodeView(discoveredPackages: DiscoveredPackage[]): ArchitectureView {
    const nodes: ArchitectureNode[] = [];
    const edges: ArchitectureRelationship[] = [];
    const fileNodeByPath = new Map<string, ArchitectureNode>();
    const maxFiles = 120;

    for (const pkg of discoveredPackages) {
      for (const sourceFile of pkg.sourceFiles) {
        if (nodes.length >= maxFiles) {
          break;
        }

        const node: ArchitectureNode = {
          id: `code:${this.toId(sourceFile.relativePath)}`,
          kind: 'code',
          name: sourceFile.relativePath,
          technology: 'Source File',
          description: `Code artifact in ${pkg.name}`,
          tags: [pkg.name],
        };
        nodes.push(node);
        fileNodeByPath.set(sourceFile.relativePath, node);
      }

      if (nodes.length >= maxFiles) {
        break;
      }
    }

    for (const pkg of discoveredPackages) {
      for (const sourceFile of pkg.sourceFiles) {
        const sourceNode = fileNodeByPath.get(sourceFile.relativePath);
        if (!sourceNode) {
          continue;
        }

        for (const importPath of sourceFile.imports) {
          if (!importPath.startsWith('.')) {
            continue;
          }

          const resolved = this.resolveFileImport(
            sourceFile.relativePath,
            importPath,
            pkg.sourceFiles
          );
          if (!resolved) {
            continue;
          }

          const targetNode = fileNodeByPath.get(resolved.relativePath);
          if (!targetNode || targetNode.id === sourceNode.id) {
            continue;
          }

          const edgeId = `rel:${this.toId(`${sourceNode.id}-${targetNode.id}`)}`;
          if (edges.some((edge) => edge.id === edgeId)) {
            continue;
          }

          edges.push({
            id: edgeId,
            source: sourceNode.id,
            target: targetNode.id,
            kind: 'uses',
            description: 'File import dependency',
            confidence: 0.65,
            evidence: {
              files: [sourceFile.relativePath],
              symbols: [importPath],
            },
          });
        }
      }
    }

    return {
      id: 'code',
      level: 'code',
      title: 'Code View',
      nodes,
      edges,
    };
  }

  private async discoverSourceFiles(
    packagePathAbsolute: string,
    repositoryRoot: string
  ): Promise<SourceFile[]> {
    const packageRelativePath = path.relative(repositoryRoot, packagePathAbsolute) || '.';
    const sourceRoot = path.join(packagePathAbsolute, 'src');
    const sourceFiles: SourceFile[] = [];

    const exists = await this.directoryExists(sourceRoot);
    if (!exists) {
      return sourceFiles;
    }

    const stack: string[] = [sourceRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      let entries: Dirent[] = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (!entry.isFile() || !this.isSourceCodeFile(entry.name)) {
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.join(
          packageRelativePath,
          path.relative(packagePathAbsolute, fullPath)
        );
        sourceFiles.push({
          relativePath: relativePath.replace(/\\/g, '/'),
          imports: this.extractImports(content),
        });
      }
    }

    return sourceFiles;
  }

  private deriveComponents(sourceFiles: SourceFile[]): string[] {
    const components = new Set<string>();
    for (const file of sourceFiles) {
      components.add(this.componentNameFromFilePath(file.relativePath));
    }

    if (components.size === 0) {
      components.add('root');
    }

    return Array.from(components).sort((a, b) => a.localeCompare(b));
  }

  private componentNameFromFilePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/');
    const srcIndex = normalized.indexOf('/src/');
    if (srcIndex === -1) {
      return 'root';
    }

    const afterSrc = normalized.slice(srcIndex + '/src/'.length);
    const firstSegment = afterSrc.split('/')[0];
    return firstSegment || 'root';
  }

  private componentNameFromImportPath(sourceFilePath: string, importPath: string): string {
    const sourceDir = path.posix.dirname(sourceFilePath);
    const resolvedPath = path.posix.normalize(path.posix.join(sourceDir, importPath));
    return this.componentNameFromFilePath(resolvedPath);
  }

  private resolveFileImport(
    sourceFilePath: string,
    importPath: string,
    candidates: SourceFile[]
  ): SourceFile | null {
    const sourceDir = path.posix.dirname(sourceFilePath);
    const base = path.posix.normalize(path.posix.join(sourceDir, importPath));
    const candidatePaths = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      path.posix.join(base, 'index.ts'),
      path.posix.join(base, 'index.tsx'),
      path.posix.join(base, 'index.js'),
      path.posix.join(base, 'index.jsx'),
    ];

    for (const candidate of candidatePaths) {
      const found = candidates.find((item) => item.relativePath === candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private extractImports(fileContent: string): string[] {
    const imports = new Set<string>();
    const importRegex = /import\s+[^'"\n]*['"]([^'"\n]+)['"]/g;
    const importOnlyRegex = /import\(['"]([^'"\n]+)['"]\)/g;
    const requireRegex = /require\(['"]([^'"\n]+)['"]\)/g;

    for (const regex of [importRegex, importOnlyRegex, requireRegex]) {
      let match: RegExpExecArray | null = regex.exec(fileContent);
      while (match) {
        const dep = match[1];
        if (dep) {
          imports.add(dep);
        }
        match = regex.exec(fileContent);
      }
    }

    return Array.from(imports);
  }

  private isSourceCodeFile(fileName: string): boolean {
    return ['.ts', '.tsx', '.js', '.jsx'].some((ext) => fileName.endsWith(ext));
  }

  private async directoryExists(directoryPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(directoryPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private detectTechnology(parsed: PackageJson, relativePath: string): string {
    const allDeps = {
      ...(parsed.dependencies || {}),
      ...(parsed.devDependencies || {}),
    };

    if (allDeps.next) {
      return 'Next.js';
    }
    if (allDeps['@nestjs/common']) {
      return 'NestJS';
    }
    if (relativePath.includes('apps/cli')) {
      return 'Node.js CLI';
    }
    if (allDeps.react) {
      return 'React';
    }

    return 'TypeScript/Node.js';
  }

  private createSnapshotId(): string {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const project = this.toId(this.configuration.githubRepository || 'project');
    return `${project}-${now}`;
  }

  private toId(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
