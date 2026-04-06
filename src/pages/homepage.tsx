import { BookCheck, type LucideIcon } from "lucide-react"

export default function HomePage(){
    return(
        <>
        <div className="min-h-screen flex w-full flex-col items-center bg-white gap-10 select-none">
            {/* NAV BAR */}
            <div className="flex w-[95vw] h-auto items-center border-b-1 border-black px-3 py-4 justify-between">
                <h1 className="m-0 text-2xl font-light text-black">
                    OneForAll
                </h1>

                <div className="flex gap-10">
                    <a href="" className="text-sm font-bold">NOTES</a>
                    <a href="" className="text-sm font-bold">MOCK EXAM</a>
                    <a href="" className="text-sm font-bold">PREVIOUS EXAMS</a>
                </div>

            </div>
            
            {/* HERO */}
            <div className="w-[95vw] h-[40vh] flex items-end justify-end px-8 py-4 border-r-5 border-black">
                <h1 className="text-5xl">
                    April 26 is almost here
                </h1>
            </div>

            {/* INFORMATION */}
            <div className="w-full min-h-[20vh] flex flex-col items-center">
                <h1 className="text-xl font-light">
                    What the hell is OFA?
                </h1>
                <div className="w-full h-[50vh] flex justify-between items-center px-10">
                    <div className="flex flex-col items-center justify-center">

                        <div className="h-40 aspect-square rounded-full border-8 border-black flex items-center justify-center">
                            <BookCheck className="h-17 w-20"></BookCheck>
                        </div>

                        <h1 className="text-sm">
                            A repository of philnits shit
                        </h1>
                    </div>

                    <div className="flex flex-col items-center justify-center">

                        <div className="h-40 aspect-square rounded-full border-8 border-black flex items-center justify-center">
                            <BookCheck className="h-17 w-20"></BookCheck>
                        </div>

                        <h1 className="text-sm">
                            A repository of philnits shit
                        </h1>
                    </div>


                    <div className="flex flex-col items-center justify-center">

                        <div className="h-40 aspect-square rounded-full border-8 border-black flex items-center justify-center">
                            <BookCheck className="h-17 w-20"></BookCheck>
                        </div>

                        <h1 className="text-sm">
                            A repository of philnits shit
                        </h1>
                    </div>

                </div>
            </div>


        </div>
        </>
    )
}


type IconWithDescProps = {
    content: string
    Icon: LucideIcon
}

export function IconWithDesc({ content, Icon }: IconWithDescProps) {
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="flex h-40 aspect-square items-center justify-center rounded-full border-8 border-black">
                <Icon className="h-10 w-10" />
            </div>

            <h1 className="text-sm text-black">{content}</h1>
        </div>
    )
}