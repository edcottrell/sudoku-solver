// TODO: Make use of tuples
// TODO: Error detection (conflicts between cells)
// TODO: Impossibility detection (initial state of puzzle contains conflict)
// TODO: Impossibility detection (no candidates left for one or more cells)
// TODO: Non-determinate solution detection
// TODO: Experimentation / hypothesis testing
// TODO: Support non-9x9 puzzle sizes

import * as process from "process";

export type SudokuAction = {
    actionType : SudokuActionType,
    cells? : number[],
    candidates? : number[],
    actionReason : SudokuActionReason,
};

export const enum SudokuActionReason {
    ONLY_CANDIDATE = 0,
    ROW_CHECK, // row mates eliminate candidate, or this is the only cell in the row that could have this value
    COLUMN_CHECK, // column mates eliminate candidate, or this is the only cell in the column that could have this value
    BOX_CHECK, // box mates eliminate candidate, or this is the only cell in the box that could have this value
    ROW_TUPLE_CHECK, // row has a tuple that eliminates a candidate for this cell
    COLUMN_TUPLE_CHECK, // column has a tuple that eliminates a candidate for this cell
    BOX_TUPLE_CHECK, // box has a tuple that eliminates a candidate for this cell
    MAX_CHECKS_EXCEEDED,
    MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
    ERROR_DETECTED_DUPLICATE_VALUE,
    ERROR_DETECTED_NO_CANDIDATES,
    PUZZLE_SOLVED,
}

export const enum SudokuActionType {
    NO_ACTION = 0,
    FILL_CELL = 1,
    FILL_CANDIDATES = 2,
    REMOVE_CANDIDATES = 3,
    IDENTIFY_TUPLE = 4,
    QUIT_TRYING_MAX_CHECKS_EXCEEDED,
    QUIT_TRYING_MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
    QUIT_TRYING_ERROR_DETECTED_DUPLICATE_VALUE,
    QUIT_TRYING_ERROR_DETECTED_NO_CANDIDATES,
    PUZZLE_SOLVED,
}

export type SudokuCell = {
    value? : number,
    candidates : number[],
    row : number,
    column : number,
    box : number,
    given : boolean,
    index : number,
};

export const enum SudokuFilterCondition {
    ALL_CELLS ,
    FILLED_CELLS,
    UNFILLED_CELLS,
}

export type SudokuPuzzle = {
    rowsCompleted : boolean[],
    columnsCompleted : boolean[],
    cells: SudokuCell[],
    boxes: number[][],
    boxesCompleted : boolean[],
    actions : SudokuAction[],
    checkCounter : number,
    lastCheckWithAction : number | null,
    solveParameters : {
        maxChecks : number,
        maxChecksWithoutAction : number,
    },
};

export const FORMAT = {
    Reset : "",
    Bright : "",
    Dim : "",
    Underscore : "",
    Blink : "",
    Reverse : "",
    Hidden : "",
    FgBlack : "",
    FgRed : "",
    FgGreen : "",
    FgYellow : "",
    FgBlue : "",
    FgMagenta : "",
    FgCyan : "",
    FgWhite : "",
    FgGray : "",
    BgBlack : "",
    BgRed : "",
    BgGreen : "",
    BgYellow : "",
    BgBlue : "",
    BgMagenta : "",
    BgCyan : "",
    BgWhite : "",
    BgGray : "",
};

function checkCell(puzzle : SudokuPuzzle, cellNumber : number) {
    const cell = puzzle.cells[cellNumber];
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkWhetherCellIsOnlyPossibilityInRowForAnyNumber(puzzle, cell);
    }
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkWhetherCellIsOnlyPossibilityInColumnForAnyNumber(puzzle, cell);
    }
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkWhetherCellIsOnlyPossibilityInBoxForAnyNumber(puzzle, cell);
    }
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkCellAgainstRow(puzzle, cell);
    }
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkCellAgainstColumn(puzzle, cell);
    }
    if (okayToKeepTrying(puzzle) && !cell.hasOwnProperty('value')) {
        checkCellAgainstBox(puzzle, cell);
    }
}

function checkCellAgainstArrayOfCells(puzzle : SudokuPuzzle, cell : SudokuCell, comparisonCells : SudokuCell[], reasonForActions : SudokuActionReason) {
    if (cell.hasOwnProperty('value')) {
        // it already has a value, so skip further checks
        return;
    }
    for (const comparisonCell of comparisonCells) {
        checkCellAgainstCell(puzzle, cell, comparisonCell, reasonForActions);
        if (cell.candidates.length === 1) {
            if (!cell.hasOwnProperty('value')) {
                puzzle.checkCounter++;
                fillCellWithValue(puzzle, cell, cell.candidates[0], SudokuActionReason.ONLY_CANDIDATE);
            }
            break;
        }
    }
}

function checkCellAgainstBox(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    const filledCellsInBox = getCellsInBox(puzzle, cell.box, SudokuFilterCondition.FILLED_CELLS, cell.index);
    checkCellAgainstArrayOfCells(puzzle, cell, filledCellsInBox, SudokuActionReason.BOX_CHECK);
}

function checkCellAgainstCell(puzzle : SudokuPuzzle, cell : SudokuCell, comparisonCell : SudokuCell, reasonForActions : SudokuActionReason) {
    if (cell.index === comparisonCell.index) {
        // we're comparing the cell to itself; skip it
        return;
    }
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    puzzle.checkCounter++;
    const comparisonValue = comparisonCell.hasOwnProperty('value') ? comparisonCell.value : null;
    if (comparisonValue) {
        const comparisonValueIndex = cell.candidates.indexOf(comparisonValue);
        if (comparisonValueIndex >= 0) {
            removeCandidateFromCell(puzzle, cell, comparisonValue, reasonForActions);
        }
    }
}

function checkCellAgainstColumn(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    const filledCellsInColumn = getCellsInColumn(puzzle, cell.column, SudokuFilterCondition.FILLED_CELLS, cell.index);
    checkCellAgainstArrayOfCells(puzzle, cell, filledCellsInColumn, SudokuActionReason.COLUMN_CHECK);
}

function checkCellAgainstRow(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    const filledCellsInRow = getCellsInRow(puzzle, cell.row, SudokuFilterCondition.FILLED_CELLS, cell.index);
    checkCellAgainstArrayOfCells(puzzle, cell, filledCellsInRow, SudokuActionReason.ROW_CHECK);
}

function checkWhetherCellIsOnlyPossibilityInAreaForAnyNumber(puzzle : SudokuPuzzle, cellsToCheckAgainst : SudokuCell[], cell : SudokuCell, reasonForActions : SudokuActionReason) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }

    for (let candidateIndex = 0; candidateIndex < cell.candidates.length; candidateIndex++) {
        const candidate = cell.candidates[candidateIndex];
        let possibilityFound = false;
        for (let cellToCheckIndex = 0; cellToCheckIndex < cellsToCheckAgainst.length; cellToCheckIndex++) {
            const comparisonCell = cellsToCheckAgainst[cellToCheckIndex];
            if (cell.index === comparisonCell.index) {
                continue;
            }
            puzzle.checkCounter++;
            if (-1 !== comparisonCell.candidates.indexOf(candidate)) {
                possibilityFound = true;
                break;
            }
            if (!okayToKeepTrying(puzzle)) {
                break;
            }
        }
        if (!possibilityFound) {
            fillCellWithValue(puzzle, cell, candidate, reasonForActions);
            break;
        }
        if (!okayToKeepTrying(puzzle)) {
            break;
        }
    }
}

function checkWhetherCellIsOnlyPossibilityInBoxForAnyNumber(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    checkWhetherCellIsOnlyPossibilityInAreaForAnyNumber(puzzle,
        getCellsInBox(puzzle, cell.box, SudokuFilterCondition.ALL_CELLS, null),
        cell,
        SudokuActionReason.BOX_CHECK);
}

function checkWhetherCellIsOnlyPossibilityInColumnForAnyNumber(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    checkWhetherCellIsOnlyPossibilityInAreaForAnyNumber(puzzle,
        getCellsInColumn(puzzle, cell.column, SudokuFilterCondition.ALL_CELLS, null),
        cell,
        SudokuActionReason.COLUMN_CHECK);
}

function checkWhetherCellIsOnlyPossibilityInRowForAnyNumber(puzzle : SudokuPuzzle, cell : SudokuCell) {
    if (cell.hasOwnProperty('value')) {
        // this cell is already filled in; skip it
        return;
    }
    checkWhetherCellIsOnlyPossibilityInAreaForAnyNumber(puzzle,
        getCellsInRow(puzzle, cell.row, SudokuFilterCondition.ALL_CELLS, null),
        cell,
        SudokuActionReason.ROW_CHECK);
}

function getCellsMeetingCriterion(puzzle : SudokuPuzzle, criterion : (cell : SudokuCell) => boolean, filterCondition : SudokuFilterCondition, excludeIndex : number | null) {
    return puzzle.cells
        .filter(criterion)
        .filter((c : SudokuCell) => {
            switch (filterCondition) {
                case SudokuFilterCondition.ALL_CELLS: return true;
                case SudokuFilterCondition.FILLED_CELLS: return c.hasOwnProperty('value');
                case SudokuFilterCondition.UNFILLED_CELLS: return !c.hasOwnProperty('value');
                default:
                    throw (new Error(`Invalid filtering condition ${filterCondition}`));
            }
        })
        .filter((c : SudokuCell) => {
            return (excludeIndex === null || excludeIndex !== c.index);
        });
}

function getCellsInBox(puzzle : SudokuPuzzle, boxIndex : number, filterCondition : SudokuFilterCondition, excludeIndex : number | null) {
    return getCellsMeetingCriterion(puzzle,
        (c : SudokuCell) => { return c.box === boxIndex; },
        filterCondition,
        excludeIndex
        );
}

function getCellsInColumn(puzzle : SudokuPuzzle, column : number, filterCondition : SudokuFilterCondition, excludeIndex : number | null) {
    return getCellsMeetingCriterion(puzzle,
        (c : SudokuCell) => { return c.column === column; },
        filterCondition,
        excludeIndex
    );
}

function getCellsInRow(puzzle : SudokuPuzzle, row : number, filterCondition : SudokuFilterCondition, excludeIndex : number | null) {
    return getCellsMeetingCriterion(puzzle,
        (c : SudokuCell) => { return c.row === row; },
        filterCondition,
        excludeIndex
    );
}

function getUnfilledCells(puzzle : SudokuPuzzle) : SudokuCell[] {
    return puzzle.cells.filter(c => !c.hasOwnProperty('value'));
}

function getUnfilledNeighborsOfCell(puzzle : SudokuPuzzle, cell : SudokuCell) : SudokuCell[] {
    return puzzle.cells.filter((neighbor : SudokuCell) : boolean => {
       return cell.index !== neighbor.index
           && !neighbor.hasOwnProperty('value')
           && ((cell.box === neighbor.box) || (cell.column === neighbor.column) || (cell.row === neighbor.row));
    });
}

function fillCellWithValue(puzzle : SudokuPuzzle, cell : SudokuCell, value : number, reasonForActions : SudokuActionReason) {
    if (cell.hasOwnProperty('value')) {
        throw (new Error(`ERROR at step ${puzzle.checkCounter}: Asked to fill in cell ${cell.index} (row ${cell.row + 1}, column ${cell.column + 1}) with value ${value}, but it already has a value (${cell.value})...`))
    }
    cell.value = value;
    cell.candidates = [value];
    const action : SudokuAction = {
        actionType : SudokuActionType.FILL_CELL,
        cells : [cell.index],
        candidates : [value],
        actionReason : reasonForActions,
    }
    logAction(puzzle, action);

    let reasonText;
    switch (reasonForActions) {
        case SudokuActionReason.ONLY_CANDIDATE: reasonText = "cell had only one candidate"; break;
        case SudokuActionReason.BOX_CHECK: reasonText = "no other cell in this box could have this value"; break;
        case SudokuActionReason.COLUMN_CHECK: reasonText = "no other cell in this column could have this value"; break;
        case SudokuActionReason.ROW_CHECK: reasonText = "no other cell in this row could have this value"; break;
        default: reasonText = "NO EXPLANATION GIVEN. 'TIS A MYSTERY";
    }

    // Update all "neighbors" of this cell that aren't filled in yet
    const unfilledNeighbors : SudokuCell[] = getUnfilledNeighborsOfCell(puzzle, cell);
    for (const neighbor of unfilledNeighbors) {
        const neighborReason : SudokuActionReason = (cell.box === neighbor.box)
            ? SudokuActionReason.BOX_CHECK
            : (cell.column === neighbor.column ? SudokuActionReason.COLUMN_CHECK : SudokuActionReason.ROW_CHECK);
        removeCandidateFromCell(puzzle, neighbor, cell.value, neighborReason);
    }

    console.log(`Step ${puzzle.checkCounter}: Filled in cell ${cell.index} (row ${cell.row + 1}, column ${cell.column + 1}) with value ${value} because ${reasonText}...`);
    outputPuzzle(puzzle, cell.index);
}

function initializeCandidates(puzzle : SudokuPuzzle) {
    const unfilledCells : SudokuCell[] = getUnfilledCells(puzzle);
    for (let cellIndex = 0; cellIndex < unfilledCells.length; cellIndex++) {
        const cell : SudokuCell = unfilledCells[cellIndex];
        if (cell.hasOwnProperty('value') && typeof cell.value === 'number') {
            cell.candidates = [cell.value];
        } else {
            // Start with all possibilities
            cell.candidates = [1,2,3,4,5,6,7,8,9];
            // Then remove candidates based on the context
            checkCellAgainstBox(puzzle, cell);
            checkCellAgainstColumn(puzzle, cell);
            checkCellAgainstRow(puzzle, cell);
        }
    }
}

function initializeColors(color : boolean = true) {
    FORMAT.Reset = color ? "\x1b[0m" : '';
    FORMAT.Bright = color ? "\x1b[1m" : '';
    FORMAT.Dim = color ? "\x1b[2m" : '';
    FORMAT.Underscore = color ? "\x1b[4m" : '';
    FORMAT.Blink = color ? "\x1b[5m" : '';
    FORMAT.Reverse = color ? "\x1b[7m" : '';
    FORMAT.Hidden = color ? "\x1b[8m" : '';

    FORMAT.FgBlack = color ? "\x1b[30m" : '';
    FORMAT.FgRed = color ? "\x1b[31m" : '';
    FORMAT.FgGreen = color ? "\x1b[32m" : '';
    FORMAT.FgYellow = color ? "\x1b[33m" : '';
    FORMAT.FgBlue = color ? "\x1b[34m" : '';
    FORMAT.FgMagenta = color ? "\x1b[35m" : '';
    FORMAT.FgCyan = color ? "\x1b[36m" : '';
    FORMAT.FgWhite = color ? "\x1b[37m" : '';
    FORMAT.FgGray = color ? "\x1b[90m" : '';

    FORMAT.BgBlack = color ? "\x1b[40m" : '';
    FORMAT.BgRed = color ? "\x1b[41m" : '';
    FORMAT.BgGreen = color ? "\x1b[42m" : '';
    FORMAT.BgYellow = color ? "\x1b[43m" : '';
    FORMAT.BgBlue = color ? "\x1b[44m" : '';
    FORMAT.BgMagenta = color ? "\x1b[45m" : '';
    FORMAT.BgCyan = color ? "\x1b[46m" : '';
    FORMAT.BgWhite = color ? "\x1b[47m" : '';
    FORMAT.BgGray = color ? "\x1b[100m" : '';
}

function initializeEmpty9x9SudokuPuzzle() {
    const newPuzzle : SudokuPuzzle = {
        rowsCompleted : [],
        columnsCompleted : [],
        cells : [],
        boxes : [[],[],[],[],[],[],[],[],[]],
        boxesCompleted : [],
        actions : [],
        checkCounter : 0,
        lastCheckWithAction : null,
        solveParameters : {
            maxChecks : 10000,
            maxChecksWithoutAction : 500,
        },
    };
    for (let row = 0; row < 9; row++) {
        newPuzzle.rowsCompleted[row] = false;
        newPuzzle.columnsCompleted[row] = false;
        newPuzzle.boxesCompleted[row] = false;
        for (let column = 0; column < 9; column++) {
            const cellIndex : number = row * 9 + column;
            const boxRow : number = (row < 3) ? 0 : ((row < 6) ? 1 : 2);
            const boxColumn : number = (column < 3) ? 0 : ((column < 6) ? 1 : 2);
            const boxNumber : number = boxRow * 3 + boxColumn;
            const newCell : SudokuCell = {
                candidates : [],
                row : row,
                column : column,
                box : boxNumber,
                given : false,
                index : cellIndex,
            };
            newPuzzle.cells.push(newCell);
            newPuzzle.boxes[boxNumber].push(cellIndex);
        }
    }
    return newPuzzle;
}

function initializePuzzleFromArray(values : number[][]) : SudokuPuzzle {
    const puzzle : SudokuPuzzle = initializeEmpty9x9SudokuPuzzle();
    for (let row = 0; row < 9; row++) {
        for (let column = 0; column < 9; column++) {
            const cellIndex = row * 9 + column;
            if (values[row][column] !== 0) {
                puzzle.cells[cellIndex].value = values[row][column];
                puzzle.cells[cellIndex].given = true;
            }
        }
    }
    return puzzle;
}

function logAction(puzzle : SudokuPuzzle, action : SudokuAction) {
    puzzle.actions.push(action);
    puzzle.lastCheckWithAction = puzzle.checkCounter;
}

function okayToKeepTrying(puzzle : SudokuPuzzle) : boolean {
    if (puzzleIsSolved(puzzle)) {
        return false;
    }
    if (puzzle.checkCounter >= puzzle.solveParameters.maxChecks) {
        const action : SudokuAction = {
            actionType : SudokuActionType.QUIT_TRYING_MAX_CHECKS_EXCEEDED,
            cells : [],
            candidates : [],
            actionReason : SudokuActionReason.MAX_CHECKS_EXCEEDED,
        };
        logAction(puzzle, action);
        return false;
    }
    if (puzzle.lastCheckWithAction === null && puzzle.checkCounter >= puzzle.solveParameters.maxChecksWithoutAction) {
        const action : SudokuAction = {
            actionType : SudokuActionType.QUIT_TRYING_MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
            cells : [],
            candidates : [],
            actionReason : SudokuActionReason.MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
        };
        logAction(puzzle, action);
        return false;
    }
    if (puzzle.lastCheckWithAction !== null && puzzle.checkCounter - puzzle.lastCheckWithAction >= puzzle.solveParameters.maxChecksWithoutAction) {
        const action : SudokuAction = {
            actionType : SudokuActionType.QUIT_TRYING_MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
            cells : [],
            candidates : [],
            actionReason : SudokuActionReason.MAX_CHECKS_WITHOUT_ACTION_EXCEEDED,
        };
        logAction(puzzle, action);
        return false;
    }
    return true;
}

function outputPuzzle(puzzle : SudokuPuzzle, cellIndexToHighlight? : number) {
    if (!cellIndexToHighlight) {
        cellIndexToHighlight = -1;
    }
    for (let row = 0; row < 9; row++) {
        let rowOutput = '';
        if (row % 3 === 0) {
            rowOutput += "+-------+-------+-------+\n";
        }
        for (let column = 0; column < 9; column++) {
            const cell : SudokuCell = puzzle.cells[row * 9 + column];
            if (column % 3 === 0) {
                rowOutput += '| ';
            }
            if (cell.hasOwnProperty('value')) {
                rowOutput += (cell.given ? FORMAT.FgCyan : FORMAT.FgGreen)
                    + (cell.index === cellIndexToHighlight ? FORMAT.Reverse : '')
                    + `${cell.value}${FORMAT.Reset} `;
            } else {
                rowOutput += '  ';
            }
        }
        console.log(rowOutput + '|');
    }
    console.log("+-------+-------+-------+");
}

function outputPuzzleAsStringOfNumbers(puzzle : SudokuPuzzle) : string {
    let output = '';
    for (const cell of puzzle.cells) {
        output += cell.hasOwnProperty('value') ? cell.value : '0';
    }
    return output;
}

function puzzleIsSolved(puzzle : SudokuPuzzle) : boolean {
    const unfilledCells : SudokuCell[] = getUnfilledCells(puzzle);
    const solved : boolean = (unfilledCells.length === 0);
    if (solved) {
        if (puzzle.actions.length === 0 || puzzle.actions[puzzle.actions.length - 1].actionType !== SudokuActionType.PUZZLE_SOLVED) {
            const action : SudokuAction = {
                actionType : SudokuActionType.PUZZLE_SOLVED,
                cells : [],
                candidates : [],
                actionReason : SudokuActionReason.PUZZLE_SOLVED,
            };
            logAction(puzzle, action);
        }
    }
    return solved;
}

function removeCandidateFromCell(puzzle : SudokuPuzzle, cell: SudokuCell, candidate : number, reasonForActions : SudokuActionReason) {
    const candidateIndex = cell.candidates.indexOf(candidate);
    if (candidateIndex === -1) {
        // This wasn't a candidate, anyway, so move on
        return;
    }
    cell.candidates.splice(candidateIndex, 1);
    const action : SudokuAction = {
        actionType : SudokuActionType.REMOVE_CANDIDATES,
        cells : [cell.index],
        candidates : [candidate],
        actionReason : reasonForActions,
    };
    logAction(puzzle, action);
    if (cell.candidates.length === 1) {
        fillCellWithValue(puzzle, cell, cell.candidates[0], SudokuActionReason.ONLY_CANDIDATE);
    }
}

function showReasonForQuitting(puzzle : SudokuPuzzle) {
    if (puzzleIsSolved(puzzle)) {
        try {
            verifySolution(puzzle);
        } catch (err) {
            console.error(err);
            process.exit(-1);
        }
        console.log(`Solved the puzzle in ${puzzle.checkCounter.toLocaleString()} steps!`);
        outputPuzzle(puzzle);
    } else {
        console.error(`Failed to solve the puzzle after ${puzzle.checkCounter.toLocaleString()} steps!`);
        const lastAction = puzzle.actions[puzzle.actions.length - 1];
        let lastActionReasonText;
        switch (lastAction.actionReason) {
            case SudokuActionReason.MAX_CHECKS_EXCEEDED:
                lastActionReasonText = `Exceeded maximum number of checks (${puzzle.solveParameters.maxChecks.toLocaleString()})`;
                break;
            case SudokuActionReason.MAX_CHECKS_WITHOUT_ACTION_EXCEEDED:
                lastActionReasonText = `Exceeded maximum number of checks without any actions (${puzzle.solveParameters.maxChecksWithoutAction.toLocaleString()})`;
                break;
            default:
                lastActionReasonText = 'Unknown!';
                break;
        }
        console.error(`Reason for failure: ${lastActionReasonText}`)
        outputPuzzle(puzzle);
    }
}

function solvePuzzle(puzzle : SudokuPuzzle, maxChecks : number = 10000, maxChecksWithoutAction = 500) {
    if (maxChecks) {
        puzzle.solveParameters.maxChecks = maxChecks;
    }
    if (maxChecksWithoutAction) {
        puzzle.solveParameters.maxChecksWithoutAction = maxChecksWithoutAction;
    }
    console.log('Starting solve...');
    initializeCandidates(puzzle);
    while (okayToKeepTrying(puzzle)) {
        const unfilledCells : SudokuCell[] = getUnfilledCells(puzzle);
        for (const cell of unfilledCells) {
            checkCell(puzzle, cell.index);
        }
    }
    showReasonForQuitting(puzzle);
}

function verifySolution(puzzle : SudokuPuzzle) {
    let valid = true;
    for (const cell of puzzle.cells) {
        const cellsInBox = getCellsInBox(puzzle, cell.box, SudokuFilterCondition.ALL_CELLS, cell.index);
        const cellsInColumn = getCellsInColumn(puzzle, cell.column, SudokuFilterCondition.ALL_CELLS, cell.index);
        const cellsInRow = getCellsInRow(puzzle, cell.row, SudokuFilterCondition.ALL_CELLS, cell.index);
        if (cellsInBox.filter((c) : boolean => { return !c.hasOwnProperty('value') || c.value === cell.value} ).length) {
            valid = false;
            throw new Error(`Conflict found! Cell ${cell.index} (row ${cell.row + 1}, column ${cell.column + 1}) `
                + `has the same value (${cell.value}) as another cell in the same box.`
            );
        }
        if (cellsInColumn.filter((c) : boolean => { return !c.hasOwnProperty('value') || c.value === cell.value} ).length) {
            valid = false;
            throw new Error(`Conflict found! Cell ${cell.index} (row ${cell.row + 1}, column ${cell.column + 1}) `
                + `has the same value (${cell.value}) as another cell in the same column.`
            );
        }
        if (cellsInRow.filter((c) : boolean => { return !c.hasOwnProperty('value') || c.value === cell.value} ).length) {
            valid = false;
            throw new Error(`Conflict found! Cell ${cell.index} (row ${cell.row + 1}, column ${cell.column + 1}) `
                + `has the same value (${cell.value}) as another cell in the same row.`
            );
        }
    }
}


initializeColors(true);
let puzzleValues = [
    [5,3,0,0,7,0,0,0,0],
    [6,0,0,1,9,5,0,0,0],
    [0,9,8,0,0,0,0,6,0],
    [8,0,0,0,6,0,0,0,3],
    [4,0,0,8,0,3,0,0,1],
    [7,0,0,0,2,0,0,0,6],
    [0,6,0,0,0,0,2,8,0],
    [0,0,0,4,1,9,0,0,5],
    [0,0,0,0,8,0,0,7,9]];

const puzzle = initializePuzzleFromArray(puzzleValues);
/*
console.log(puzzle.cells[0],
    puzzle.cells[1],
    puzzle.cells[2],
    puzzle.cells[9],
    puzzle.cells[10],
    puzzle.cells[11],
    puzzle.cells[18],
    puzzle.cells[19],
    puzzle.cells[20]);
process.exit(-1);
*/
solvePuzzle(puzzle);
console.log(`The string representation of this puzzle's solution is \n${outputPuzzleAsStringOfNumbers(puzzle)}`);