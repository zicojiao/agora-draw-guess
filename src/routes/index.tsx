import { createFileRoute } from '@tanstack/react-router'
import { DrawGuessHome } from '#/components/draw-guess-home'
import { siteUrl } from '#/lib/site-config'
export const Route = createFileRoute('/')({head:()=>({links:[{rel:'canonical',href:siteUrl('/')}]}),component:DrawGuessHome})
