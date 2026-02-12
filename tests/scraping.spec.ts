
import { test, expect } from '@playwright/test';
import { parseReactionsFromCode } from '../src/scripts/power-reader/utils/reactions';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Reaction Scraping Logic', () => {

    test('[PR-REACT-01] should scrape reactions from a real LW bundle snapshot', () => {
        const fixturePath = path.resolve('tests', 'fixtures', 'lw-client-sample.js');
        // Only run if fixture exists (avoid failing on CI without network)
        if (fs.existsSync(fixturePath)) {
            const content = fs.readFileSync(fixturePath, 'utf8');
            const reactions = parseReactionsFromCode(content);



            // Should find at least 50 reactions (LW has ~80+)
            expect(reactions.length).toBeGreaterThan(50);

            // Check for key reactions
            expect(reactions.find(r => r.name === 'agree')).toBeDefined();
            expect(reactions.find(r => r.name === 'insightful')).toBeDefined(); // Has description
            expect(reactions.find(r => r.name === 'confused')).toBeDefined(); // Has filter

            // Check data integrity of a sample
            const insightful = reactions.find(r => r.name === 'insightful');
            expect(insightful?.label).toBe('Insightful');
            expect(insightful?.searchTerms?.length).toBeGreaterThan(0);
        } else {
            test.skip();
        }
    });

    test('should correctly parse standard reaction definitions', () => {
        // Sample snippet mimicking minimal LW client bundle structure
        const sampleCode = `
            var unused = {foo:1};
            var r1 = {name:"agree",label:"Agreed",searchTerms:["check","upvote"],svg:"/img/check.svg",description:"I agree"};
            var r2 = {name:"disagree",label:"Disagree",svg:"/img/x.svg"};
            var r3 = {name:"confused",label:"Confused",svg:"/img/confused.svg",filter:{opacity:.5,scale:1.2}};
        `;

        const reactions = parseReactionsFromCode(sampleCode);


        expect(reactions).toHaveLength(3);

        // Check r1
        expect(reactions[0]).toMatchObject({
            name: "agree",
            label: "Agreed",
            svg: "/img/check.svg",
            description: "I agree",
            searchTerms: ["check", "upvote"]
        });

        // Check r2 (no search terms)
        expect(reactions[1]).toMatchObject({
            name: "disagree",
            label: "Disagree",
            svg: "/img/x.svg"
        });
        expect(reactions[1].searchTerms).toBeUndefined();

        // Check r3 (filter parsing)
        expect(reactions[2]).toMatchObject({
            name: "confused",
            label: "Confused",
            svg: "/img/confused.svg",
            filter: { opacity: 0.5, scale: 1.2 }
        });
    });

    test('should handle description functions and complex search terms', () => {
        // Complex sample with function description (should be ignored or handled gracefully) and quoted search terms
        const complexCode = `
            {name:"insightful",label:"Insightful",searchTerms:["lightbulb","aha!"],svg:"/img/lightbulb.svg",description:e=>\`Hello \${e}\`},
            {name:"deprecated",label:"Old",svg:"old.svg",deprecated:!0}
        `;

        const reactions = parseReactionsFromCode(complexCode);

        expect(reactions).toHaveLength(2);

        // Insightful (Function-based description)
        expect(reactions[0].name).toBe("insightful");
        expect(reactions[0].searchTerms).toContain("lightbulb");
        expect(reactions[0].description).toBe("This post/comment Hello ${e}"); // Simplified expectation based on regex capture

        // Deprecated
        expect(reactions[1].name).toBe("deprecated");
        expect(reactions[1].deprecated).toBe(true);
    });

    test('should return empty array for non-matching code', () => {
        const noMatch = `var x = { name: "foo", label: "bar" };`; // Missing quotes on keys, missing svg
        expect(parseReactionsFromCode(noMatch)).toHaveLength(0);
    });

    test('[PR-REACT-01] should be resilient against realistic minified code patterns', () => {
        // Based on actual observation of webpack bundles (no spaces, comma separated properties)
        const minified = '{name:"strong-argument",label:"Strong Argument",searchTerms:["strong","argument"],svg:"/img/strong.svg"},{name:"weak-argument",label:"Weak Argument",svg:"/img/weak.svg"}';

        const reactions = parseReactionsFromCode(minified);
        expect(reactions).toHaveLength(2);
        expect(reactions[0].name).toBe("strong-argument");
        expect(reactions[1].name).toBe("weak-argument");
    });

});
