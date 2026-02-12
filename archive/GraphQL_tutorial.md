**Source:** [GraphQL tutorial for LessWrong and Effective Altruism Forum — LessWrong](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum)
**Captured:** 2/1/2026, 3:20:24 AM
**Web Clipper Max Version:** 1.0.362

---

> [!CAUTION]
> **Field Name Update (2026):** The field `plaintextExcerpt` on the `Comment` type has been removed or renamed in recent LessWrong API updates. In this codebase, we use **`htmlBody`** instead. If you see examples below using `plaintextExcerpt`, substitute them with `htmlBody`.

---

## 

*   <section data-type="comment">
    
    
    
    [LESSWRONG](https://www.lesswrong.com/)
    
    
    
    
    
    </section>

[Wei Dai](https://www.lesswrong.com/users/wei-dai)

•

•

•

•

+[Programming](https://www.lesswrong.com/w/programming)[Site Meta](https://www.lesswrong.com/w/site-meta)[Personal Blog](https://www.lesswrong.com/posts/5conQhfa4rgb4SaWx/site-guide-personal-blogposts-vs-frontpage-posts)

# 102

# [GraphQL tutorial for LessWrong and Effective Altruism Forum](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum)

by [riceissa](https://www.lesswrong.com/users/riceissa?from=post_header)

 8th Dec 2018 (2018-12-08T19:51:59.514Z)

*   <section data-type="comment">
    
    
    
    This post is a tutorial on using GraphQL to query for information about LessWrong and the Effective Altruism Forum. It's mostly intended for people who have wanted to explore LW/EA Forum data but have found GraphQL intimidating (this was the case for myself until several weeks ago).
    
    # General steps for writing a query
    
    (This section will make more sense if you have seen some example queries; see next section.)
    
    For the queries that I know how to do, here is the general outline of steps:
    
    1.  Go to [https://www.lesswrong.com/graphiql](https://www.lesswrong.com/graphiql) or [https://forum.effectivealtruism.org/graphiql](https://forum.effectivealtruism.org/graphiql) depending on which forum you want to query data for.
        
    2.  Figure out what the output type should be (e.g. `comments`, `comment`, `posts`, `post`).
        
    3.  Type `{output_type(input)}` into GraphiQL and hover over `input`.
        
        Here is what it looks like for the `comment` output type:
        
        [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-input-hover.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-input-hover.png)
        
        Here is what it looks like for the `comments` output type:
        
        [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comments-input-hover.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comments-input-hover.png)
        
    4.  Click on the type that appears after `input` (e.g. `MultiCommentInput`, `SingleCommentInput`). A column on the right should appear (if it was not there already). Depending on the fields listed in that column, there will now be two ways to proceed. (Generally, it seems like singular output types (e.g. `comment`) will have `selector` and plural output types (e.g. `comments`) will have `terms`.)
        
        Here is what it looks like for the `comment` output type. In the image, I have already clicked on `SingleCommentInput` so you can see `selector` under the documentation (rightmost) column.
        
        [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-SingleCommentInput.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-SingleCommentInput.png)
        
        Here is what it looks like for the `comments` output type. Again, in this image, I have already clicked on `MultiCommentInput` so you can see `terms` under the documentation (rightmost) column.
        
        [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comments-MultiCommentInput.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comments-MultiCommentInput.png)
        
        In the fields listed, if there is `selector` (e.g. for `comment`):
        
        *   Click on the selector type (e.g. `CommentSelectorUniqueInput`). Use one of the fields (e.g. `_id`) to pick out the specific item you want.
            
            Here is what you should click on:
            
            [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-CommentSelectorUniqueInput.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-CommentSelectorUniqueInput.png)
            
            What it looks like after you have clicked:
            
            [![image](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-fields.png)](https://raw.githubusercontent.com/riceissa/ea-forum-reader/master/tutorial/comment-fields.png)
            
        
        If there is `terms` (e.g. `comments`):
        
        *   Go to the [collections](https://github.com/LessWrong2/Lesswrong2/tree/devel/packages/lesswrong/lib/collections) directory in the LessWrong 2.0 codebase, and find the `views.js` file for your output type. For example, if your output type is `comments`, then the corresponding `views.js` file is located at [`collections/comments/views.js`](https://github.com/LessWrong2/Lesswrong2/blob/devel/packages/lesswrong/lib/collections/comments/views.js).
            
        *   Look through the various "views" in the `views.js` file to see if there is a relevant view. (There is also a default view if you don't select any view.) The main things to pay attention to are the `selector` block (which controls how the results will be filtered) and the `options` block (which mainly controls how the results are sorted).
            
        *   Pass in parameters for that view using keys in the `terms` block.
            
    5.  Start a `results` block, and select the fields you want to see for this output type. (If you don't select any fields, it will default to all fields, so you can do that once and delete the fields you don't need.)
        
    
    # Examples
    
    I've built a sample interface for both LessWrong and EA Forum that allows an easy way to access the queries used to generate pages:
    
    *   [https://lw2.issarice.com/](https://lw2.issarice.com/)
    *   [https://eaforum.issarice.com/](https://eaforum.issarice.com/)
    
    By passing `format=queries` in the URL to any page, you can view the GraphQL queries that were made to generate that page. Rather than showing many examples in this post, I will just show one example in this post, and let you explore the reader.
    
    As an example, consider the page [https://eaforum.issarice.com/?view=top](https://eaforum.issarice.com/?view=top). Clicking on "Queries" at the top of the page takes you to the page [https://eaforum.issarice.com/?view=top&offset=0&before=&after=&format=queries](https://eaforum.issarice.com/?view=top&offset=0&before=&after=&format=queries) Here you will see the following:
    
    ```
        {
          posts(input: {
            terms: {
              view: "top"
              limit: 50
              meta: null  # this seems to get both meta and non-meta posts
    
    
    
            }
          }) {
            results {
              _id
              title
              slug
              pageUrl
              postedAt
              baseScore
              voteCount
              commentsCount
              meta
              question
              url
              user {
                username
                slug
              }
            }
          }
        }
    
    Run this query
    
    
    
        {
          comments(input: {
            terms: {
              view: "recentComments"
              limit: 10
            }
          }) {
            results {
              _id
              post {
                _id
                title
                slug
              }
              user {
                _id
                slug
              }
              plaintextExcerpt
              htmlHighlight
              postId
              pageUrl
            }
          }
        }
    
    Run this query
    ```
    
    Clicking on "Run this query" (not linked in this tutorial, but linked in the actual page) below each query will take you to the GraphiQL page with the query preloaded. There, you can click on the "Execute Query" button (which looks like a play button) to actually run the query and see the result.
    
    I should note that my reader implementation is optimized for my own (probably unusual) consumption and learning. For article-reading and commenting purposes (i.e. not for learning how to use GraphQL), most users will probably prefer to use the official versions of the forums or the GreaterWrong counterparts.
    
    # Tips
    
    *   In GraphiQL, hovering over some words like `input` and `results` and then clicking on the resulting tooltip will show the parameters that can be passed to that block.
    *   Forum search is *not* done via GraphQL. Rather, a separate API (the Algolia search API) is used. Use of the search API is outside the scope of this tutorial. This is also why the search results page on my reader ([example](https://eaforum.issarice.com/search.php?q=hpmor)) has no "Queries" link ([for now](https://github.com/riceissa/ea-forum-reader/issues/8)).
    *   For queries that use a `terms` block: even though a "view" is just a [shorthand](http://docs.vulcanjs.org/terms-parameters.html) for a selector/options pair, it is not possible to pass in arbitrary selector/options pairs (due to the way security is handled by Vulcan). If you don't use a view, the default view is selected. The main consequence of this is that you won't be able to make some queries that you might want to make.
    *   Some queries are hard/impossible to do. Examples: (1) getting comments of a user by placing conditions on the parent comment or post (e.g. finding all comments by user 1 where they are replying to user 2); (2) querying and sorting posts by a function of arbitrary fields (e.g. as a function of `baseScore` and `voteCount`); (3) finding the highest-karma users looking only at the past days of activity.
    *   GraphQL vs GraphiQL: `/graphiql` seems to be endpoint for the interactive explorer for GraphQL, whereas `/graphql` is the endpoint for the actual API. So when you are actually querying the API (via a program you write) I think you want to be using [https://www.lesswrong.com/graphql](https://www.lesswrong.com/graphql) and [https://forum.effectivealtruism.org/graphql](https://forum.effectivealtruism.org/graphql) (or at least, that is what I am doing and it works).
    
    # Acknowledgments
    
    Thanks to:
    
    *   Louis Francini for helping me with some GraphQL queries and for feedback on the post and the reader.
    *   Oliver Habryka for answering some questions I had about GraphQL.
    *   Vipul Naik for funding my work on this post and some of my work on the reader.
    
    
    
    
    
    
    
    
    
    
    
    </section>

# 102

Mentioned in

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo Pingback-karma">60</span> [Forum Karma: view stats and find highly-rated comments for any LW user](https://www.lesswrong.com/posts/kSaJzPebJbzgkfRMe/forum-karma-view-stats-and-find-highly-rated-comments-for)

[<span class="CommentsTableOfContents-commentKarma">1</span> papetoast](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#9uqBLoSbKewTPwR5S)

[<span class="CommentsTableOfContents-commentKarma">2</span> riceissa](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#oLtojEhJHbuiDZQab)

[<span class="CommentsTableOfContents-commentKarma">1</span> Milli | Martin](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#669avhiYcbD9yHC46)

[<span class="CommentsTableOfContents-commentKarma">9</span> NunoSempere](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#cAntSHAgBDMbmqE97)

[<span class="CommentsTableOfContents-commentKarma">12</span> namespace](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#hN9q86oM4oHA2iDaY)

[<span class="CommentsTableOfContents-commentKarma">6</span> Raemon](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#b6msjtJyekPhCw53q)

[<span class="CommentsTableOfContents-commentKarma">2</span> SimonM](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#Rxosu9ftPTdEjsPLx)

[<span class="CommentsTableOfContents-commentKarma">1</span> sepremento](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#xairyRa5AFLHpxTea)

*   <section id="posts-thread-new-comment" data-type="comment">
    
    
    
    New Comment
    
    Text goes here! See lesswrong.com/editor for info about everything the editor can do.
    
    Markdown
    
    
    
    
    
    
    
    
    
    
    
    </section>

8 comments, sorted by

magic (new & upvoted)

No new comments since  Yesterday at 1:23 PM (2026-01-31T19:23:03.334Z)

*   <section id="9uqBLoSbKewTPwR5S" data-type="comment">
    
    
    
    [papetoast](https://www.lesswrong.com/users/papetoast)[4mo (2025-10-14T00:31:18.649Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=9uqBLoSbKewTPwR5S) <span class="OverallVoteAxis-voteScore">1</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    For step 3 it seems like you now want to hover over `output_type` instead of `input`
    
    </section>
    
    *   <section id="oLtojEhJHbuiDZQab" data-type="comment" data-reply-to="9uqBLoSbKewTPwR5S">
        
        
        
        [riceissa](https://www.lesswrong.com/users/riceissa)[3mo (2025-10-25T02:48:27.099Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=oLtojEhJHbuiDZQab) <span class="OverallVoteAxis-voteScore">2</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
        
        Yes, you are correct. Not sure if I want to bother with editing the post, since a bunch of other things have changed in the past 7 years and I don't at the moment have the energy to go through the whole post and bring it up to date. But I appreciate you for bringing this up!
        
        
        
        
        
        
        
        
        
        </section>

*   <section id="669avhiYcbD9yHC46" data-type="comment">
    
    
    
    [Milli | Martin](https://www.lesswrong.com/users/milli-or-martin)[2mo (2025-11-21T15:02:04.133Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=669avhiYcbD9yHC46) <span class="OverallVoteAxis-voteScore">1</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    GraphQL beginner here: Where do I find the schema that I can import to Postman to inspect it there?
    
    
    
    
    
    
    
    
    
    </section>

*   <section id="cAntSHAgBDMbmqE97" data-type="comment">
    
    
    
    [NunoSempere](https://www.lesswrong.com/users/nunosempere)[5y (2021-01-06T11:14:47.555Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=cAntSHAgBDMbmqE97) <span class="OverallVoteAxis-voteScore">9</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    I've come back to this occasionally, thanks. Here are two more snippets:
    
    ## **To get one post** 
    
    ```
    {
            post(
                input: {  
                selector: {
                    _id: "Here goes the id"
                }      
                }) 
            {
                result {
                _id
                title
                slug
                pageUrl
                postedAt
                baseScore
                voteCount
                commentCount
                meta
                question
                url
                user {
                    username
                    slug
                    karma
                    maxPostCount
                    commentCount
                }
                }
            }
    }
    ```
    
    or, as a JavaScript/node function:
    
    ```
    let graphQLendpoint = 'https://forum.effectivealtruism.org/graphql' // or https://www.lesswrong.com/graphql. Note that this is not the same as the graph*i*ql visual interface talked about in the post. 
    
    async function fetchPost(id){ 
      // note the async
      let response  = await fetch(graphQLendpoint, ({
        method: 'POST',
        headers: ({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(({ query: `
           {
            post(
                input: {  
                selector: {
                    _id: "${id}"
                }      
                }) 
            {
                result {
                _id
                title
                slug
                pageUrl
                postedAt
                baseScore
                voteCount
                commentCount
                meta
                question
                url
                user {
                    username
                    slug
                    karma
                    maxPostCount
                    commentCount
                }
                }
            }
    }`
    })),
      }))
      .then(res => res.json())
      .then(res => res.data.post? res.data.post.result : undefined)  
      return response
    }
    ```
    
    ## **To get a user**
    
    ```
    {
      user(input: {
        selector: {
          slug: "heregoestheslug"
        }
      }){
        result{
          username
          pageUrl
          karma
          maxPostCount
          commentCount
        }
      }
      
    }
    ```
    
    Or, as a JavaScript function
    
    ```
    let graphQLendpoint = 'https://forum.effectivealtruism.org/graphql' // or https://www.lesswrong.com/graphql. Note that this is not the same as the graph*i*ql visual interface talked about in the post. 
    
    async function fetchAuthor(slug){
      // note the async
      let response  = await fetch(graphQLendpoint, ({
        method: 'POST',
        headers: ({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(({ query: `
           {
      user(input: {
        selector: {
          slug: "${slug}"
        }
      }){
        result{
          username
          pageUrl
          karma
          maxPostCount
          commentCount
        }
      }
      
    }`
    })),
      }))
      .then(res => res.json())
      .then(res => res.data.user? res.data.user.result : undefined)  
      return response
    }
    ```
    
    
    
    
    
    
    
    
    
    </section>

*   <section id="hN9q86oM4oHA2iDaY" data-type="comment">
    
    
    
    [namespace](https://www.lesswrong.com/users/ingres)[7y (2018-12-09T06:34:05.702Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=hN9q86oM4oHA2iDaY) <span class="OverallVoteAxis-voteScore">12</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    The official LessWrong 2 server is pretty heavy, so running it locally might be a problem for some people.
    
    Whistling Lobsters 2.0 uses [a clone of the LW 2 API called Accordius](https://github.com/JD-P/accordius) as its backend. Accordius is, with some minor differences, nearly an exact copy of the pre-October LW 2 API. It was developed with the goal that you could put [the GreaterWrong software](https://github.com/kronusaturn/lw2-viewer) in front of it and it would function without changes. Unfortunately due to some implementation disagreements between Graphene and the reference GraphQL library in JavaScript, it's only about 95% compatible at the time of cloning.
    
    Still, this thing will run on a potato (or more specifically, my years-old Intel atom based netbook) *with* GreaterWrong running on the same box as the front end. That makes it a pretty good option for anyone who's looking to understand GraphQL and the LW 2 API. This implementation does not take into account the changes made in the big API update in October. As a consequence, it may be more useful at this point for learning GraphQL than the LW 2 API specifically.
    
    (Note to future readers: The GraphQL API is considered legacy for Accordius in the long term, so if you're reading this many months or even years from now, you may have to go back to the first alpha releases to get the functionality described here. Pre 1.0 perhaps.)
    
    
    
    
    
    
    
    
    
    </section>

*   <section id="b6msjtJyekPhCw53q" data-type="comment">
    
    
    
    [Raemon](https://www.lesswrong.com/users/raemon)[7y (2018-12-08T20:40:36.285Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=b6msjtJyekPhCw53q) <span class="OverallVoteAxis-voteScore">6</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    Thanks for writing this up! I've added it to the [LW Open Source sequence](https://www.lesswrong.com/s/h8DebDmuode4TMcRj).
    
    
    
    
    
    
    
    
    
    </section>

*   <section id="Rxosu9ftPTdEjsPLx" data-type="comment">
    
    
    
    [SimonM](https://www.lesswrong.com/users/simonm)[3y (2022-12-28T22:22:33.713Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=Rxosu9ftPTdEjsPLx) <span class="OverallVoteAxis-voteScore">2</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    Just in case anyone is struggling to find the relevant bits of the the codebase, my best guess is the link for the collections folder in github is now [here](https://github.com/ForumMagnum/ForumMagnum/tree/8fd46067fc72a4bf7fd5038c5ea0b22031790c46/packages/lesswrong/lib/collections).
    
    You are looking in "views.ts" eg [.../collections/comments/views.ts](https://github.com/ForumMagnum/ForumMagnum/blob/8fd46067fc72a4bf7fd5038c5ea0b22031790c46/packages/lesswrong/lib/collections/comments/views.ts)
    
    The best thing to search for (I found) was ".addView(" and see what fits your requirements
    
    
    
    
    
    
    
    
    
    </section>

*   <section id="xairyRa5AFLHpxTea" data-type="comment">
    
    
    
    [sepremento](https://www.lesswrong.com/users/sepremento)[2y (2023-09-21T08:36:24.199Z)](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum?commentId=xairyRa5AFLHpxTea) <span class="OverallVoteAxis-voteScore">1</span>  <span class="AgreementVoteAxis-agreementScore">0</span> 
    
    Can please someone post an example on how to find comments with negative agreement but positive approval?
    
    
    
    
    
    
    
    
    
    </section>

[Moderation Log](https://www.lesswrong.com/moderation)

More from [riceissa](https://www.lesswrong.com/users/riceissa)

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma">95</span> [How to get nerds fascinated about mysterious chronic illness research?](https://www.lesswrong.com/posts/joPjaY43a4umyCkJK/how-to-get-nerds-fascinated-about-mysterious-chronic-illness)

[Q](https://www.lesswrong.com/questions)

[riceissa](https://www.lesswrong.com/users/riceissa), [romeostevensit](https://www.lesswrong.com/users/romeostevensit)

 2y (2024-05-27T22:58:29.707Z)

50

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma">64</span> [Idea: medical hypotheses app for mysterious chronic illnesses](https://www.lesswrong.com/posts/D9h2jhFnfvrwiuupX/idea-medical-hypotheses-app-for-mysterious-chronic-illnesses)

[riceissa](https://www.lesswrong.com/users/riceissa)

 3y (2023-05-19T20:49:24.526Z)

8

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma">73</span> [Timeline of AI safety](https://www.lesswrong.com/posts/SEfjw57Qw8mCzy36n/timeline-of-ai-safety)

[](https://timelines.issarice.com/wiki/Timeline_of_AI_safety)[Ω](https://alignmentforum.org/posts/SEfjw57Qw8mCzy36n/timeline-of-ai-safety)

[riceissa](https://www.lesswrong.com/users/riceissa)

 5y (2021-02-07T22:29:00.811Z)

6

[View more](https://www.lesswrong.com/users/riceissa)

Curated and popular this week

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma LWPostsItem-karmaPredictedReviewWinner">255</span> [Canada Lost Its Measles Elimination Status Because We Don't Have Enough Nurses Who Speak Low German](https://www.lesswrong.com/posts/H8RdAbAmsqbpBWoDd/canada-lost-its-measles-elimination-status-because-we-don-t)

[](https://www.lesswrong.com/recommendations)[](https://www.jenn.site/why-canada-really-lost-its-measles-elimination-status/)

[jenn](https://www.lesswrong.com/users/jenn)

 1d (2026-01-31T04:03:57.209Z)

11

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma LWPostsItem-karmaPredictedReviewWinner">149</span> [Ada Palmer: Inventing the Renaissance](https://www.lesswrong.com/posts/doADJmyy6Yhp47SJ2/ada-palmer-inventing-the-renaissance)

[Martin Sustrik](https://www.lesswrong.com/users/sustrik)

 6d (2026-01-26T04:40:13.334Z)

8

 <span class="Typography-root Typography-body2 PostsItem2MetaInfo-metaInfo LWPostsItem-karma">105</span> [How to Hire a Team](https://www.lesswrong.com/posts/cojSyfxfqfm4kpCbk/how-to-hire-a-team)

[Gretta Duleba](https://www.lesswrong.com/users/gretta-duleba)

 2d (2026-01-29T22:39:40.665Z)

2

[8](https://www.lesswrong.com/posts/LJiGhpq8w4Badr5KJ/graphql-tutorial-for-lesswrong-and-effective-altruism-forum#comments)

x

---
**END OF SITE CONTENT**