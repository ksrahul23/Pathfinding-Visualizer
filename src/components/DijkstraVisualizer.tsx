'use client';

import React, { useState, useCallback, useEffect } from 'react';

// Types
interface Cell {
    row: number;
    col: number;
    isWall: boolean;
    isStart: boolean;
    isEnd: boolean;
    distance: number;
    isVisited: boolean;
    previousNode: Cell | null;
    isPath: boolean;
}

interface VisualizerState {
    grid: Cell[][];
    isRunning: boolean;
    isComplete: boolean;
    startNode: { row: number; col: number } | null;
    endNode: { row: number; col: number } | null;
    mode: 'wall' | 'start' | 'end';
    stats: {
        nodesVisited: number;
        pathLength: number;
        executionTime: number;
    };
}

const ROWS = 20;
const COLS = 40;
const ANIMATION_SPEED = 15; // milliseconds

export default function DijkstraVisualizer() {
    const [algorithm, setAlgorithm] = useState<'Dijkstra' | 'BFS' | 'DFS' | 'Bellman-Ford'>('Dijkstra');
    const [state, setState] = useState<VisualizerState>({
        grid: [],
        isRunning: false,
        isComplete: false,
        startNode: null,
        endNode: null,
        mode: 'wall',
        stats: {
            nodesVisited: 0,
            pathLength: 0,
            executionTime: 0
        }
    });

    // Mouse interaction state
    const [mouseIsPressed, setMouseIsPressed] = useState(false);
    const [isDrawingWalls, setIsDrawingWalls] = useState(false);
    const [showInfo, setShowInfo] = useState(true);

    // Initialize grid
    const initializeGrid = useCallback(() => {
        const grid: Cell[][] = [];
        for (let row = 0; row < ROWS; row++) {
            const currentRow: Cell[] = [];
            for (let col = 0; col < COLS; col++) {
                currentRow.push({
                    row,
                    col,
                    isWall: false,
                    isStart: false,
                    isEnd: false,
                    distance: Infinity,
                    isVisited: false,
                    previousNode: null,
                    isPath: false
                });
            }
            grid.push(currentRow);
        }
        return grid;
    }, []);

    // Initialize grid on component mount
    useEffect(() => {
        setState(prev => ({
            ...prev,
            grid: initializeGrid()
        }));
    }, [initializeGrid]);

    // Handle mouse down
    const handleMouseDown = useCallback((row: number, col: number) => {
        if (state.isRunning) return;

        setMouseIsPressed(true);

        const currentMode = state.mode;
        const currentGrid = state.grid;
        const cell = currentGrid[row][col];

        if (currentMode === 'wall' && !cell.isStart && !cell.isEnd) {
            const newWallState = !cell.isWall;
            setIsDrawingWalls(newWallState);
        }

        setState(prev => {
            const newGrid = prev.grid.map(gridRow => [...gridRow]);
            const targetCell = newGrid[row][col];

            if (prev.mode === 'start') {
                // Clear previous start
                if (prev.startNode) {
                    newGrid[prev.startNode.row][prev.startNode.col] = { ...newGrid[prev.startNode.row][prev.startNode.col], isStart: false };
                }
                targetCell.isStart = true;
                targetCell.isWall = false;
                return {
                    ...prev,
                    grid: newGrid,
                    startNode: { row, col },
                    isComplete: false
                };
            } else if (prev.mode === 'end') {
                // Clear previous end
                if (prev.endNode) {
                    newGrid[prev.endNode.row][prev.endNode.col] = { ...newGrid[prev.endNode.row][prev.endNode.col], isEnd: false };
                }
                targetCell.isEnd = true;
                targetCell.isWall = false;
                return {
                    ...prev,
                    grid: newGrid,
                    endNode: { row, col },
                    isComplete: false
                };
            } else if (prev.mode === 'wall') {
                if (!targetCell.isStart && !targetCell.isEnd) {
                    newGrid[row][col] = { ...targetCell, isWall: !targetCell.isWall };
                }
                return {
                    ...prev,
                    grid: newGrid,
                    isComplete: false
                };
            }

            return prev;
        });
    }, [state.isRunning, state.mode, state.grid]);

    // Handle mouse enter (for dragging)
    const handleMouseEnter = useCallback((row: number, col: number) => {
        if (!mouseIsPressed || state.isRunning || state.mode !== 'wall') return;

        setState(prev => {
            const newGrid = prev.grid.map(gridRow => [...gridRow]);
            const cell = newGrid[row][col];

            if (!cell.isStart && !cell.isEnd) {
                newGrid[row][col] = { ...cell, isWall: isDrawingWalls };
            }

            return {
                ...prev,
                grid: newGrid,
                isComplete: false
            };
        });
    }, [mouseIsPressed, isDrawingWalls, state.isRunning, state.mode]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        setMouseIsPressed(false);
        setIsDrawingWalls(false);
    }, []);

    // Get neighbors of a cell
    const getNeighbors = useCallback((node: Cell, grid: Cell[][]) => {
        const neighbors: Cell[] = [];
        const { row, col } = node;

        if (row > 0) neighbors.push(grid[row - 1][col]);
        if (row < ROWS - 1) neighbors.push(grid[row + 1][col]);
        if (col > 0) neighbors.push(grid[row][col - 1]);
        if (col < COLS - 1) neighbors.push(grid[row][col + 1]);

        return neighbors.filter(neighbor => !neighbor.isWall);
    }, []);

    // Get shortest path
    const getShortestPath = useCallback((endNode: Cell) => {
        const path: Cell[] = [];
        let currentNode: Cell | null = endNode;

        while (currentNode !== null) {
            path.unshift(currentNode);
            currentNode = currentNode.previousNode;
        }

        return path;
    }, []);

    // Algorithm runner
    const runAlgorithm = useCallback(async () => {
        if (!state.startNode || !state.endNode) {
            alert('Please set both start and end points!');
            return;
        }

        const startTime = performance.now();
        setState(prev => ({
            ...prev,
            isRunning: true,
            isComplete: false,
            stats: { nodesVisited: 0, pathLength: 0, executionTime: 0 }
        }));

        const grid = state.grid.map(row =>
            row.map(cell => ({ ...cell, distance: Infinity, isVisited: false, previousNode: null, isPath: false }))
        );

        const startNode = grid[state.startNode.row][state.startNode.col];
        const endNode = grid[state.endNode.row][state.endNode.col];
        startNode.distance = 0;
        const visitedNodesInOrder: Cell[] = [];

        if (algorithm === 'Dijkstra') {
            const unvisitedNodes: Cell[] = [];
            for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                    unvisitedNodes.push(grid[row][col]);
                }
            }

            while (unvisitedNodes.length > 0) {
                unvisitedNodes.sort((a, b) => a.distance - b.distance);
                const closestNode = unvisitedNodes.shift()!;
                if (closestNode.isWall) continue;
                if (closestNode.distance === Infinity) break;

                closestNode.isVisited = true;
                visitedNodesInOrder.push(closestNode);
                if (closestNode === endNode) break;

                const neighbors = getNeighbors(closestNode, grid);
                for (const neighbor of neighbors) {
                    const distance = closestNode.distance + 1;
                    if (distance < neighbor.distance) {
                        neighbor.distance = distance;
                        neighbor.previousNode = closestNode;
                    }
                }
            }
        } else if (algorithm === 'BFS') {
            const queue: Cell[] = [startNode];
            startNode.isVisited = true;
            while(queue.length > 0) {
                const current = queue.shift()!;
                if (current.isWall) continue;
                visitedNodesInOrder.push(current);
                if (current === endNode) break;

                const neighbors = getNeighbors(current, grid);
                for (const neighbor of neighbors) {
                    if (!neighbor.isVisited) {
                        neighbor.isVisited = true;
                        neighbor.previousNode = current;
                        queue.push(neighbor);
                    }
                }
            }
        } else if (algorithm === 'DFS') {
            const stack: Cell[] = [startNode];
            while(stack.length > 0) {
                const current = stack.pop()!;
                if (current.isWall) continue;
                
                if (!current.isVisited) {
                    current.isVisited = true;
                    visitedNodesInOrder.push(current);
                    if (current === endNode) break;
                    
                    const neighbors = getNeighbors(current, grid);
                    for (const neighbor of neighbors) {
                        if (!neighbor.isVisited && !neighbor.isWall) {
                            neighbor.previousNode = current;
                            stack.push(neighbor);
                        }
                    }
                }
            }
        } else if (algorithm === 'Bellman-Ford') {
            const queue: Cell[] = [startNode];
            const inQueue = Array(ROWS).fill(false).map(() => Array(COLS).fill(false));
            inQueue[startNode.row][startNode.col] = true;

            while (queue.length > 0) {
                const current = queue.shift()!;
                inQueue[current.row][current.col] = false;
                if (current.isWall) continue;
                
                if (!current.isVisited) {
                    current.isVisited = true;
                    visitedNodesInOrder.push(current);
                }

                const neighbors = getNeighbors(current, grid);
                for (const neighbor of neighbors) {
                    if (current.distance + 1 < neighbor.distance) {
                        neighbor.distance = current.distance + 1;
                        neighbor.previousNode = current;
                        if (!inQueue[neighbor.row][neighbor.col] && !neighbor.isWall) {
                            queue.push(neighbor);
                            inQueue[neighbor.row][neighbor.col] = true;
                        }
                    }
                }
            }
        }

        // Animate visited nodes
        for (let i = 0; i < visitedNodesInOrder.length; i++) {
            await new Promise(resolve => setTimeout(resolve, ANIMATION_SPEED));

            setState(prev => {
                const newGrid = prev.grid.map(row => [...row]);
                const node = visitedNodesInOrder[i];
                newGrid[node.row][node.col] = { ...newGrid[node.row][node.col], isVisited: true };
                return { ...prev, grid: newGrid };
            });
        }

        // Brief pause before showing path
        await new Promise(resolve => setTimeout(resolve, 200));

        // Animate shortest path
        const shortestPath = getShortestPath(endNode);
        if (shortestPath.length > 1) {
            for (let i = 0; i < shortestPath.length; i++) {
                await new Promise(resolve => setTimeout(resolve, ANIMATION_SPEED * 2));

                setState(prev => {
                    const newGrid = prev.grid.map(row => [...row]);
                    const node = shortestPath[i];
                    newGrid[node.row][node.col] = { ...newGrid[node.row][node.col], isPath: true };
                    return { ...prev, grid: newGrid };
                });
            }
        }

        const endTime = performance.now();
        const executionTime = Math.round(endTime - startTime);

        setState(prev => ({
            ...prev,
            isRunning: false,
            isComplete: true,
            stats: {
                nodesVisited: visitedNodesInOrder.length,
                pathLength: shortestPath.length > 0 ? shortestPath.length - 1 : 0,
                executionTime
            }
        }));
    }, [state.startNode, state.endNode, state.grid, getNeighbors, getShortestPath, algorithm]);

    // Clear grid
    const clearGrid = useCallback(() => {
        if (state.isRunning) return;

        setState(prev => ({
            ...prev,
            grid: initializeGrid(),
            startNode: null,
            endNode: null,
            isComplete: false
        }));
    }, [state.isRunning, initializeGrid]);

    // Clear path only
    const clearPath = useCallback(() => {
        if (state.isRunning) return;

        setState(prev => {
            const newGrid = prev.grid.map(row =>
                row.map(cell => ({
                    ...cell,
                    isVisited: false,
                    isPath: false,
                    distance: Infinity,
                    previousNode: null
                }))
            );
            return { ...prev, grid: newGrid, isComplete: false };
        });
    }, [state.isRunning]);

    // Generate random maze
    const generateMaze = useCallback(() => {
        if (state.isRunning) return;

        setState(prev => {
            const newGrid = prev.grid.map(row =>
                row.map(cell => ({
                    ...cell,
                    isWall: Math.random() < 0.3 && !cell.isStart && !cell.isEnd,
                    isVisited: false,
                    isPath: false,
                    distance: Infinity,
                    previousNode: null
                }))
            );
            return { ...prev, grid: newGrid, isComplete: false };
        });
    }, [state.isRunning]);

    // Add sample start and end points
    const addSamplePoints = useCallback(() => {
        if (state.isRunning) return;

        setState(prev => {
            const newGrid = prev.grid.map(row => [...row]);

            // Clear existing start/end
            if (prev.startNode) {
                newGrid[prev.startNode.row][prev.startNode.col].isStart = false;
            }
            if (prev.endNode) {
                newGrid[prev.endNode.row][prev.endNode.col].isEnd = false;
            }

            // Set new start and end
            const startRow = Math.floor(ROWS / 4);
            const startCol = Math.floor(COLS / 4);
            const endRow = Math.floor((3 * ROWS) / 4);
            const endCol = Math.floor((3 * COLS) / 4);

            newGrid[startRow][startCol].isStart = true;
            newGrid[startRow][startCol].isWall = false;
            newGrid[endRow][endCol].isEnd = true;
            newGrid[endRow][endCol].isWall = false;

            return {
                ...prev,
                grid: newGrid,
                startNode: { row: startRow, col: startCol },
                endNode: { row: endRow, col: endCol },
                isComplete: false
            };
        });
    }, [state.isRunning]);

    // Get cell class name
    const getCellClassName = useCallback((cell: Cell) => {
        let className = 'w-4 h-4 border cursor-pointer transition-all duration-300 relative rounded-sm ';

        if (cell.isStart) {
            className += 'bg-blue-500 shadow-md shadow-blue-500/20 border-blue-600 start-end-pulse ';
        } else if (cell.isEnd) {
            className += 'bg-rose-500 shadow-md shadow-rose-500/20 border-rose-600 start-end-pulse ';
        } else if (cell.isPath) {
            className += 'bg-amber-400 shadow-md shadow-amber-400/20 border-amber-500  ';
        } else if (cell.isVisited) {
            className += 'bg-indigo-400/60 shadow border-indigo-300/50 visited-wave ';
        } else if (cell.isWall) {
            className += 'bg-slate-700 shadow-inner border-slate-600 ';
        } else {
            className += 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 ';
        }

        return className;
    }, []);

    return (
        <div className="bg-black min-h-screen font-mono relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(34, 211, 238, 0.3) 1px, transparent 0)`,
                    backgroundSize: '20px 20px'
                }}></div>
            </div>

            <div className="relative z-10 h-screen flex flex-col">
                {/* Top Navigation Bar */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700">
                    {/* Left: Title */}
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-100 tracking-wider flex items-center gap-3">
                                {algorithm.toUpperCase()}
                                <select
                                    value={algorithm}
                                    onChange={(e) => setAlgorithm(e.target.value as 'Dijkstra' | 'BFS' | 'DFS' | 'Bellman-Ford')}
                                    disabled={state.isRunning}
                                    className="ml-2 text-sm bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1 outline-none font-sans font-normal"
                                >
                                    <option value="Dijkstra">Dijkstra</option>
                                    <option value="BFS">BFS</option>
                                    <option value="DFS">DFS</option>
                                    <option value="Bellman-Ford">Bellman-Ford</option>
                                </select>
                            </h1>
                            <div className="text-gray-500 text-xs tracking-wide mt-1 flex items-center gap-2">
                                Made by Rahul Kumar | <a href="https://github.com/ksrahul23/Path-Finder-Algo" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" /></svg> GitHub Repo</a> | <button onClick={() => setShowInfo(true)} className="text-zinc-400 hover:text-white transition-colors">ⓘ Info</button>
                            </div>
                        </div>
                        <div className="text-gray-400 text-xs tracking-widest">
                            PATHFINDING VISUALIZER
                        </div>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex items-center gap-4">
                        {/* Mode Selection */}
                        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg border border-gray-600">
                            <button
                                onClick={() => setState(prev => ({ ...prev, mode: 'start' }))}
                                className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded ${state.mode === 'start'
                                    ? 'bg-green-500 text-black shadow-md'
                                    : 'text-green-400 hover:bg-green-500/20'
                                    }`}
                                disabled={state.isRunning}
                            >
                                START
                            </button>
                            <button
                                onClick={() => setState(prev => ({ ...prev, mode: 'end' }))}
                                className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded ${state.mode === 'end'
                                    ? 'bg-red-500 text-black shadow-md'
                                    : 'text-red-400 hover:bg-red-500/20'
                                    }`}
                                disabled={state.isRunning}
                            >
                                TARGET
                            </button>
                            <button
                                onClick={() => setState(prev => ({ ...prev, mode: 'wall' }))}
                                className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded ${state.mode === 'wall'
                                    ? 'bg-gray-300 text-black shadow-md'
                                    : 'text-gray-300 hover:bg-gray-300/20'
                                    }`}
                                disabled={state.isRunning}
                            >
                                WALLS
                            </button>
                        </div>

                        {/* Main Action */}
                        <button
                            onClick={runAlgorithm}
                            className={`px-6 py-2 text-sm font-medium transition-all duration-200 rounded border ${state.isRunning
                                ? 'bg-zinc-200 text-black animate-pulse shadow-lg'
                                : 'text-zinc-200 border-zinc-500/50 hover:bg-zinc-200/10 hover:border-cyan-400'
                                } disabled:opacity-30 disabled:cursor-not-allowed`}
                            disabled={state.isRunning || !state.startNode || !state.endNode}
                        >
                            {state.isRunning ? 'EXECUTING...' : 'RUN ALGORITHM'}
                        </button>

                        {/* Utility Actions */}
                        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg border border-gray-600">
                            <button
                                onClick={clearPath}
                                className="px-2 py-1.5 text-xs font-medium text-amber-500 hover:bg-yellow-500/20 transition-all duration-200 rounded disabled:opacity-30"
                                disabled={state.isRunning}
                            >
                                CLEAR
                            </button>
                            <button
                                onClick={generateMaze}
                                className="px-2 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/20 transition-all duration-200 rounded disabled:opacity-30"
                                disabled={state.isRunning}
                            >
                                MAZE
                            </button>
                            <button
                                onClick={addSamplePoints}
                                className="px-2 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-all duration-200 rounded disabled:opacity-30"
                                disabled={state.isRunning}
                            >
                                DEMO
                            </button>
                            <button
                                onClick={clearGrid}
                                className="px-2 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-500/20 transition-all duration-200 rounded disabled:opacity-30"
                                disabled={state.isRunning}
                            >
                                RESET
                            </button>
                        </div>
                    </div>

                    {/* Right: Stats Dashboard */}
                    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-600 rounded-lg p-3 min-w-[240px]">
                        <div className="text-zinc-200 text-xs font-medium tracking-wider mb-2 text-center">
                            STATS
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-center">
                                <div className="text-gray-400">STATUS</div>
                                <div className={`font-medium ${state.isRunning ? 'text-zinc-200 animate-pulse' :
                                    state.isComplete ? (state.stats.pathLength > 0 ? 'text-green-400' : 'text-red-400') :
                                        !state.startNode ? 'text-amber-500' :
                                            !state.endNode ? 'text-orange-400' :
                                                'text-blue-400'
                                    }`}>
                                    {state.isRunning ? 'EXEC' :
                                        state.isComplete ? (state.stats.pathLength > 0 ? 'DONE' : 'NO PATH') :
                                            !state.startNode ? 'START' :
                                                !state.endNode ? 'TARGET' :
                                                    'READY'}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-gray-400">NODES</div>
                                <div className="text-zinc-200 font-medium">{state.stats.nodesVisited}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gray-400">PATH</div>
                                <div className="text-amber-500 font-medium">{state.stats.pathLength}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-gray-400">TIME</div>
                                <div className="text-green-400 font-medium">{state.stats.executionTime}ms</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex items-center justify-center p-4">
                    {/* Grid Container */}
                    <div className="flex flex-col items-center gap-3">
                        {/* Legend */}
                        <div className="flex gap-6 text-xs text-gray-400">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded shadow-sm shadow-green-500/50"></div>
                                <span>START</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded shadow-sm shadow-red-500/50"></div>
                                <span>TARGET</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-300 rounded"></div>
                                <span>WALL</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-cyan-400 rounded shadow-sm shadow-zinc-500/20"></div>
                                <span>EXPLORED</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-amber-500 rounded shadow-sm shadow-amber-500/20"></div>
                                <span>PATH</span>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="relative">
                            <div
                                className="grid gap-px bg-gray-800 p-2 rounded-lg shadow-2xl select-none border border-gray-700"
                                style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                {state.grid.map((row, rowIndex) =>
                                    row.map((cell, colIndex) => (
                                        <div
                                            key={`${rowIndex}-${colIndex}`}
                                            className={getCellClassName(cell)}
                                            onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                                            onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                                            onDragStart={(e) => e.preventDefault()}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Grid glow effect */}
                            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-zinc-500/5 via-transparent to-zinc-500/5 pointer-events-none"></div>
                        </div>

                        {/* Status Message */}
                        <div className="text-center mt-2">
                            {state.isRunning && (
                                <div className="text-zinc-200 font-medium animate-pulse text-sm">
                                    <span className="inline-block animate-spin mr-2">⟳</span>
                                    EXECUTING ALGORITHM...
                                </div>
                            )}
                            {state.isComplete && !state.isRunning && state.stats.pathLength > 0 && (
                                <div className="text-green-400 font-medium text-sm">
                                    OPTIMAL PATH FOUND
                                </div>
                            )}
                            {state.isComplete && !state.isRunning && state.stats.pathLength === 0 && (
                                <div className="text-red-400 font-medium text-sm">
                                    NO PATH FOUND
                                </div>
                            )}
                            {!state.startNode && !state.isRunning && (
                                <div className="text-amber-500 font-medium text-sm">
                                    <span className="mr-2">▶</span>
                                    SELECT START MODE AND CLICK GRID
                                </div>
                            )}
                            {state.startNode && !state.endNode && !state.isRunning && (
                                <div className="text-amber-500 font-medium text-sm">
                                    <span className="mr-2">◉</span>
                                    SELECT TARGET MODE AND CLICK GRID
                                </div>
                            )}
                            {state.startNode && state.endNode && !state.isRunning && !state.isComplete && (
                                <div className="text-zinc-200 font-medium text-sm">
                                    READY TO RUN ALGORITHM
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Modal */}
            {showInfo && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden relative">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 z-10 sticky top-0">
                            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                                <span>🧭</span> HOW IT WORKS
                            </h2>
                            <button 
                                onClick={() => setShowInfo(false)}
                                className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto text-zinc-300 space-y-6 text-sm">
                            <section>
                                <h3 className="text-white font-semibold mb-2 text-base">Interactive Grid</h3>
                                <ul className="list-disc pl-5 space-y-2 opacity-90">
                                    <li><strong>Start &amp; Target:</strong> Click &quot;START&quot; or &quot;TARGET&quot; mode, then click on any cell in the grid to place them.</li>
                                    <li><strong>Walls:</strong> Click &quot;WALLS&quot; mode. You can click to toggle individual walls, or click and drag across the grid to draw large barriers.</li>
                                    <li>The grid represents a 2D graph where each cell is connected to its non-diagonal neighbors.</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-white font-semibold mb-2 text-base">Algorithms</h3>
                                <div className="space-y-3 opacity-90">
                                    <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
                                        <p className="text-white font-medium mb-1">Dijkstra&apos;s Algorithm</p>
                                        <p>Guarantees the shortest path by exploring all possible paths systematically radiating outwards.</p>
                                    </div>
                                    <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
                                        <p className="text-white font-medium mb-1">Breadth-First Search (BFS)</p>
                                        <p>Explores neighbors level by level. Guarantees the shortest path on an unweighted grid.</p>
                                    </div>
                                    <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
                                        <p className="text-white font-medium mb-1">Depth-First Search (DFS)</p>
                                        <p>Explores as far as possible along each branch before backtracking. Does <strong>not</strong> guarantee the shortest path.</p>
                                    </div>
                                    <div className="bg-zinc-800/50 p-3 rounded border border-zinc-800">
                                        <p className="text-white font-medium mb-1">Bellman-Ford</p>
                                        <p>Similar to Dijkstra on positive weights. Utilizes SPFA edge relaxation logic.</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
